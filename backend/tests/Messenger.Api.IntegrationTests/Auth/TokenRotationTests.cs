namespace Messenger.Api.IntegrationTests.Auth;

using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Messenger.Api.IntegrationTests.Fixtures;

[Collection("Auth")]
public sealed class TokenRotationTests(AuthApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Refresh_WithValidToken_Returns200WithNewTokens()
    {
        var login = await LoginAsync();

        var response = await PostWithCookieAsync("/api/auth/refresh", login.Cookie);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var newTokens = await response.Content.ReadFromJsonAsync<TokenPairDto>();
        newTokens!.AccessToken.Should().NotBeNullOrEmpty();
        // RefreshToken не должен попадать в тело ответа — только в httpOnly-куку ниже
        newTokens.RefreshToken.Should().BeNullOrEmpty();
        GetRefreshCookie(response).Should().Contain("HttpOnly");
    }

    [Fact]
    public async Task Refresh_NewTokensDifferFromOld()
    {
        var login     = await LoginAsync();
        var response  = await PostWithCookieAsync("/api/auth/refresh", login.Cookie);
        var newTokens = await response.Content.ReadFromJsonAsync<TokenPairDto>();

        newTokens!.AccessToken.Should().NotBe(login.Tokens.AccessToken);
        // Сам refresh-токен теперь виден только в куке (не в теле ответа) — сравниваем
        // значение куки целиком, чтобы убедиться, что ротация действительно выдала новый токен
        GetCookieHeader(response).Should().NotBe(login.Cookie);
    }

    [Fact]
    public async Task Refresh_OldTokenCannotBeReusedAfterRotation()
    {
        var login = await LoginAsync();
        await PostWithCookieAsync("/api/auth/refresh", login.Cookie);

        // повторное использование старого токена должно вернуть ошибку
        var second = await PostWithCookieAsync("/api/auth/refresh", login.Cookie);

        second.IsSuccessStatusCode.Should().BeFalse();
    }

    [Fact]
    public async Task Refresh_WithInvalidToken_Returns401()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/refresh", new
        {
            token = "completely-invalid-token-value"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Logout_WithValidToken_Returns204()
    {
        var login = await LoginAsync();

        var response = await PostWithCookieAsync("/api/auth/logout", login.Cookie);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        GetRefreshCookie(response).Should().Contain("expires=Thu, 01 Jan 1970");
    }

    [Fact]
    public async Task Logout_WithInvalidToken_StillReturns204()
    {
        // Logout идемпотентен — не ошибка если токен не найден
        var response = await _client.PostAsJsonAsync("/api/auth/logout", new
        {
            refreshToken = "nonexistent-token"
        });

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Logout_TokenCannotBeUsedForRefreshAfterward()
    {
        var login = await LoginAsync();

        await PostWithCookieAsync("/api/auth/logout", login.Cookie);
        var refresh = await PostWithCookieAsync("/api/auth/refresh", login.Cookie);

        refresh.IsSuccessStatusCode.Should().BeFalse();
    }

    private async Task<AuthSession> LoginAsync()
    {
        var email = $"user_{Guid.NewGuid():N}@example.com";
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password    = "SecurePass1!",
            displayName = "Test"
        });

        var loginResp = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email,
            password = "SecurePass1!"
        });

        var tokens = (await loginResp.Content.ReadFromJsonAsync<TokenPairDto>())!;
        return new AuthSession(tokens, GetCookieHeader(loginResp));
    }

    private async Task<HttpResponseMessage> PostWithCookieAsync(string requestUri, string cookie)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, requestUri);
        request.Headers.Add("Cookie", cookie);
        return await _client.SendAsync(request);
    }

    private static string GetCookieHeader(HttpResponseMessage response) =>
        GetRefreshCookie(response).Split(';')[0];

    private static string GetRefreshCookie(HttpResponseMessage response) =>
        response.Headers.GetValues("Set-Cookie")
            .Single(cookie => cookie.StartsWith("messenger_refresh_token=", StringComparison.Ordinal));

    private sealed record AuthSession(TokenPairDto Tokens, string Cookie);

    private sealed record TokenPairDto(
        string   AccessToken,
        string   RefreshToken,
        DateTime AccessTokenExpiresAt);
}

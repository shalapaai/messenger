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
        var tokens = await LoginAsync();

        var response = await _client.PostAsJsonAsync("/api/auth/refresh", new
        {
            token = tokens.RefreshToken
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var newTokens = await response.Content.ReadFromJsonAsync<TokenPairDto>();
        newTokens!.AccessToken.Should().NotBeNullOrEmpty();
        newTokens.RefreshToken.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Refresh_NewTokensDifferFromOld()
    {
        var tokens    = await LoginAsync();
        var response  = await _client.PostAsJsonAsync("/api/auth/refresh", new { token = tokens.RefreshToken });
        var newTokens = await response.Content.ReadFromJsonAsync<TokenPairDto>();

        newTokens!.AccessToken.Should().NotBe(tokens.AccessToken);
        newTokens.RefreshToken.Should().NotBe(tokens.RefreshToken);
    }

    [Fact]
    public async Task Refresh_OldTokenCannotBeReusedAfterRotation()
    {
        var tokens = await LoginAsync();
        await _client.PostAsJsonAsync("/api/auth/refresh", new { token = tokens.RefreshToken });

        // повторное использование старого токена должно вернуть ошибку
        var second = await _client.PostAsJsonAsync("/api/auth/refresh", new { token = tokens.RefreshToken });

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
        var tokens = await LoginAsync();

        var response = await _client.PostAsJsonAsync("/api/auth/logout", new
        {
            refreshToken = tokens.RefreshToken
        });

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
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
        var tokens = await LoginAsync();

        await _client.PostAsJsonAsync("/api/auth/logout", new { refreshToken = tokens.RefreshToken });
        var refresh = await _client.PostAsJsonAsync("/api/auth/refresh", new { token = tokens.RefreshToken });

        refresh.IsSuccessStatusCode.Should().BeFalse();
    }

    private async Task<TokenPairDto> LoginAsync()
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

        return (await loginResp.Content.ReadFromJsonAsync<TokenPairDto>())!;
    }

    private sealed record TokenPairDto(
        string   AccessToken,
        string   RefreshToken,
        DateTime AccessTokenExpiresAt);
}

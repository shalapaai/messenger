namespace Messenger.Api.IntegrationTests.Auth;

using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Messenger.Api.IntegrationTests.Fixtures;

[Collection("Auth")]
public sealed class LoginEndpointTests(AuthApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Login_WithValidCredentials_Returns200WithTokens()
    {
        var email = await RegisterUserAsync();

        var response = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email,
            password = "SecurePass1!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<TokenPairDto>();
        body!.AccessToken.Should().NotBeNullOrEmpty();
        body.RefreshToken.Should().NotBeNullOrEmpty();
        body.AccessTokenExpiresAt.Should().BeAfter(DateTime.UtcNow);
        GetRefreshCookie(response).Should().Contain("HttpOnly");
    }

    [Fact]
    public async Task Login_AccessTokenIsValidJwt()
    {
        var email = await RegisterUserAsync();
        var response = await _client.PostAsJsonAsync("/api/auth/login", new { email, password = "SecurePass1!" });

        var body        = await response.Content.ReadFromJsonAsync<TokenPairDto>();
        var parts       = body!.AccessToken.Split('.');

        // JWT состоит из 3 частей: header.payload.signature
        parts.Should().HaveCount(3);
    }

    [Fact]
    public async Task Login_WithNonExistentEmail_Returns422()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email    = "nobody@example.com",
            password = "anypassword"
        });

        // LoginCommandHandler возвращает Unauthorized, который маппится как UnprocessableEntity в эндпойнте
        response.StatusCode.Should().BeOneOf(HttpStatusCode.Unauthorized, HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsError()
    {
        var email = await RegisterUserAsync();

        var response = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email,
            password = "WrongPass999!"
        });

        response.IsSuccessStatusCode.Should().BeFalse();
    }

    [Fact]
    public async Task Login_WithEmptyEmail_Returns422()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email    = "",
            password = "SecurePass1!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    private async Task<string> RegisterUserAsync()
    {
        var email = $"user_{Guid.NewGuid():N}@example.com";
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password    = "SecurePass1!",
            displayName = "Test User"
        });
        return email;
    }

    private static string GetRefreshCookie(HttpResponseMessage response) =>
        response.Headers.GetValues("Set-Cookie")
            .Single(cookie => cookie.StartsWith("messenger_refresh_token=", StringComparison.Ordinal));

    private sealed record TokenPairDto(
        string   AccessToken,
        string   RefreshToken,
        DateTime AccessTokenExpiresAt);
}

namespace Messenger.Api.IntegrationTests.Auth;

using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Messenger.Api.IntegrationTests.Fixtures;

[Collection("Auth")]
public sealed class RegisterEndpointTests(AuthApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Register_WithValidData_Returns201WithTokensAndRefreshCookie()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email       = $"user_{Guid.NewGuid():N}@example.com",
            password    = "SecurePass1!",
            displayName = "Test User"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<TokenPairDto>();
        body!.AccessToken.Should().NotBeNullOrEmpty();
        // RefreshToken не должен попадать в тело ответа — только в httpOnly-куку ниже,
        // иначе он читаем из JS/девтулс несмотря на HttpOnly
        body.RefreshToken.Should().BeNullOrEmpty();
        body.AccessTokenExpiresAt.Should().BeAfter(DateTime.UtcNow);
        GetRefreshCookie(response).Should().Contain("HttpOnly");
    }

    [Fact]
    public async Task Register_LocationHeaderPointsToAuthResource()
    {
        var email = $"loc_{Guid.NewGuid():N}@example.com";
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password    = "SecurePass1!",
            displayName = "Alice"
        });

        response.Headers.Location.Should().NotBeNull();
        response.Headers.Location!.ToString().Should().Be("/api/auth/register");
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_Returns409()
    {
        var email = $"dup_{Guid.NewGuid():N}@example.com";
        var body  = new { email, password = "SecurePass1!", displayName = "User" };

        await _client.PostAsJsonAsync("/api/auth/register", body);
        var second = await _client.PostAsJsonAsync("/api/auth/register", body);

        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Register_WithShortPassword_Returns422WithValidationErrors()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email       = "user@example.com",
            password    = "short",
            displayName = "Alice"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Password");
    }

    [Fact]
    public async Task Register_WithInvalidEmail_Returns422()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email       = "not-an-email",
            password    = "SecurePass1!",
            displayName = "Alice"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Register_WithMissingPassword_Returns422()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email    = "user@example.com",
            password = ""
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    private static string GetRefreshCookie(HttpResponseMessage response) =>
        response.Headers.GetValues("Set-Cookie")
            .Single(cookie => cookie.StartsWith("messenger_refresh_token=", StringComparison.Ordinal));

    private sealed record TokenPairDto(
        string   AccessToken,
        string   RefreshToken,
        DateTime AccessTokenExpiresAt);
}

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
    public async Task Register_WithValidData_Returns201WithUserDto()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email       = $"user_{Guid.NewGuid():N}@example.com",
            password    = "SecurePass1!",
            displayName = "Test User"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<UserDto>();
        body!.Email.Should().NotBeNullOrEmpty();
        body.Id.Should().NotBe(Guid.Empty);
        body.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(10));
    }

    [Fact]
    public async Task Register_LocationHeaderPointsToUserResource()
    {
        var email = $"loc_{Guid.NewGuid():N}@example.com";
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password    = "SecurePass1!",
            displayName = "Alice"
        });

        response.Headers.Location.Should().NotBeNull();
        response.Headers.Location!.ToString().Should().StartWith("/api/users/");
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
    public async Task Register_WithMissingDisplayName_Returns422()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email    = "user@example.com",
            password = "SecurePass1!",
            displayName = ""
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    private sealed record UserDto(Guid Id, string Email, DateTime CreatedAt);
}

namespace Messenger.Api.IntegrationTests.Fixtures;

using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

// Общий помощник для тестов Chats/Files/Messages: регистрирует нового пользователя,
// создаёт ему профиль (нужен для displayName/avatarUrl в ответах других модулей)
// и проставляет Bearer-токен на переданном HttpClient.
public static class AuthTestHelpers
{
    public static async Task<AuthenticatedUser> RegisterAndAuthenticateAsync(
        HttpClient client, string? displayName = null)
    {
        var email = $"user_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePass1!";
        displayName ??= $"Test User {Guid.NewGuid():N}"[..20];

        var registerResponse = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password,
            displayName
        });
        registerResponse.EnsureSuccessStatusCode();

        var tokens = (await registerResponse.Content.ReadFromJsonAsync<TokenPairDto>())!;
        var userId = ExtractUserIdFromJwt(tokens.AccessToken);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", tokens.AccessToken);

        var profileResponse = await client.PostAsJsonAsync("/api/users", new { displayName });
        if (!profileResponse.IsSuccessStatusCode)
            throw new Exception($"Profile creation failed: {profileResponse.StatusCode} {await profileResponse.Content.ReadAsStringAsync()}");

        return new AuthenticatedUser(userId, tokens.AccessToken, email, displayName);
    }

    private static Guid ExtractUserIdFromJwt(string accessToken)
    {
        var payload = accessToken.Split('.')[1];
        var padded  = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
        var bytes   = Convert.FromBase64String(padded.Replace('-', '+').Replace('_', '/'));
        var json = JsonDocument.Parse(Encoding.UTF8.GetString(bytes));
        // JwtTokenService issues ClaimTypes.NameIdentifier (the long XML-Soap URI), not "sub".
        var userId = json.RootElement.GetProperty(
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier").GetString()!;
        return Guid.Parse(userId);
    }

    public sealed record AuthenticatedUser(Guid UserId, string AccessToken, string Email, string DisplayName);

    private sealed record TokenPairDto(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt);
}

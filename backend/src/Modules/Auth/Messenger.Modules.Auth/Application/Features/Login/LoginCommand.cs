namespace Messenger.Modules.Auth.Application.Features.Login;

using System.Text.Json.Serialization;
using Messenger.Shared.Kernel.Abstractions;

public sealed record LoginCommand(string Email, string Password) : ICommand<LoginResultDto>;

public sealed record TokenPairDto(string AccessToken, [property: JsonIgnore] string RefreshToken, DateTime AccessTokenExpiresAt);

public sealed record LoginResultDto
{
    public bool         RequiresOtp          { get; init; }
    public string?      Email                { get; init; }
    public string?      AccessToken          { get; init; }
    [JsonIgnore]
    public string?      RefreshToken         { get; init; }
    public DateTime?    AccessTokenExpiresAt { get; init; }

    public static LoginResultDto WithTokens(TokenPairDto t) => new()
    {
        RequiresOtp          = false,
        AccessToken          = t.AccessToken,
        RefreshToken         = t.RefreshToken,
        AccessTokenExpiresAt = t.AccessTokenExpiresAt,
    };

    public static LoginResultDto WithOtp(string email) => new()
    {
        RequiresOtp = true,
        Email       = email,
    };
}

namespace Messenger.Modules.Auth.Application.Features.Login;

using Messenger.Shared.Kernel.Abstractions;

public sealed record LoginCommand(string Email, string Password) : ICommand<LoginResultDto>;

public sealed record TokenPairDto(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt);

public sealed record LoginResultDto
{
    public bool         RequiresOtp          { get; init; }
    public string?      Email                { get; init; }
    public string?      AccessToken          { get; init; }
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

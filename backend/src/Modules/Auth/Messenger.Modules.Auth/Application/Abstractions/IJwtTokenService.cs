namespace Messenger.Modules.Auth.Application.Abstractions;

public interface IJwtTokenService
{
    AccessTokenResult GenerateAccessToken(Guid userId, string email);
    string GenerateRefreshToken();
}

public sealed record AccessTokenResult(string Token, DateTime ExpiresAt);

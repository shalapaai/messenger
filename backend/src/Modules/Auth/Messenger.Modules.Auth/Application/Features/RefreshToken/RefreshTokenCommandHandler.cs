namespace Messenger.Modules.Auth.Application.Features.RefreshToken;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;
using Microsoft.Extensions.Configuration;

public sealed class RefreshTokenCommandHandler(
    IUserAuthRepository userRepository,
    IRefreshTokenRepository refreshTokenRepository,
    IJwtTokenService jwtTokenService,
    IUnitOfWork unitOfWork,
    IConfiguration configuration)
    : ICommandHandler<RefreshTokenCommand, TokenPairDto>
{
    public async Task<Result<TokenPairDto>> Handle(RefreshTokenCommand command, CancellationToken ct)
    {
        var token = await refreshTokenRepository.GetByTokenAsync(command.Token, ct);

        if (token is null || !token.IsActive)
            return Result.Failure<TokenPairDto>(Error.Unauthorized("Invalid or expired refresh token"));

        var user = await userRepository.GetByIdAsync(token.UserId, ct);
        if (user is null)
            return Result.Failure<TokenPairDto>(Error.NotFound("User"));

        token.Revoke();

        var newAccessToken  = jwtTokenService.GenerateAccessToken(user.Id, user.Email);
        var newRefreshValue = jwtTokenService.GenerateRefreshToken();
        var expirationDays  = configuration.GetValue<int>("Jwt:RefreshTokenExpirationDays", 7);
        var newRefreshToken = Domain.RefreshToken.Create(user.Id, newRefreshValue, expirationDays);

        refreshTokenRepository.Add(newRefreshToken);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(new TokenPairDto(
            newAccessToken.Token, newRefreshValue, newAccessToken.ExpiresAt));
    }
}

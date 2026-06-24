namespace Messenger.Modules.Auth.Application.Features.RefreshToken;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class RefreshTokenCommandHandler(
    IUserAuthRepository userRepository,
    IRefreshTokenRepository refreshTokenRepository,
    IJwtTokenService jwtTokenService,
    IUnitOfWork unitOfWork)
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

        // Ротация refresh token: старый отзывается, выдаётся новый
        token.Revoke();

        var newAccessToken  = jwtTokenService.GenerateAccessToken(user.Id, user.Email);
        var newRefreshValue = jwtTokenService.GenerateRefreshToken();
        var newRefreshToken = Domain.RefreshToken.Create(user.Id, newRefreshValue, expirationDays: 30);

        refreshTokenRepository.Add(newRefreshToken);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(new TokenPairDto(
            newAccessToken.Token, newRefreshValue, newAccessToken.ExpiresAt));
    }
}

namespace Messenger.Modules.Auth.Application.Features.VerifyOtp;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;

public sealed class VerifyOtpCommandHandler(
    IUserAuthRepository     userRepository,
    IJwtTokenService        jwtTokenService,
    IRefreshTokenRepository refreshTokenRepository,
    IUnitOfWork             unitOfWork,
    IMemoryCache            cache,
    IConfiguration          configuration)
    : ICommandHandler<VerifyOtpCommand, TokenPairDto>
{
    private const string CacheKeyPrefix = "otp:";

    public async Task<Result<TokenPairDto>> Handle(VerifyOtpCommand command, CancellationToken ct)
    {
        var cacheKey = CacheKeyPrefix + command.Email.ToLowerInvariant();

        if (!cache.TryGetValue<string>(cacheKey, out var storedCode) || storedCode != command.Code)
            return Result.Failure<TokenPairDto>(Error.Unauthorized("Invalid or expired code"));

        cache.Remove(cacheKey);

        var user = await userRepository.GetByEmailAsync(command.Email, ct);
        if (user is null)
            return Result.Failure<TokenPairDto>(Error.Unauthorized("Invalid or expired code"));

        if (!user.IsEmailVerified)
        {
            user.VerifyEmail();
            await unitOfWork.SaveChangesAsync(ct);
        }

        var accessToken       = jwtTokenService.GenerateAccessToken(user.Id, user.Email);
        var refreshTokenValue = jwtTokenService.GenerateRefreshToken();
        var expirationDays    = configuration.GetValue<int>("Jwt:RefreshTokenExpirationDays", 7);

        var refreshToken = Domain.RefreshToken.Create(user.Id, refreshTokenValue, expirationDays);
        refreshTokenRepository.Add(refreshToken);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(new TokenPairDto(accessToken.Token, refreshTokenValue, accessToken.ExpiresAt));
    }
}

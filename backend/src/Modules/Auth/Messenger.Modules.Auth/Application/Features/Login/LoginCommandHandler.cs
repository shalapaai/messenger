namespace Messenger.Modules.Auth.Application.Features.Login;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;

public sealed class LoginCommandHandler(
    IUserAuthRepository  userRepository,
    IPasswordHasher      passwordHasher,
    IJwtTokenService     jwtTokenService,
    IRefreshTokenRepository refreshTokenRepository,
    IUnitOfWork          unitOfWork,
    IEmailService        emailService,
    IMemoryCache         cache,
    IConfiguration       configuration)
    : ICommandHandler<LoginCommand, LoginResultDto>
{
    private const string CacheKeyPrefix = "otp:";

    public async Task<Result<LoginResultDto>> Handle(LoginCommand command, CancellationToken ct)
    {
        var user = await userRepository.GetByEmailAsync(command.Email, ct);

        if (user is null || !passwordHasher.Verify(command.Password, user.PasswordHash))
            return Result.Failure<LoginResultDto>(Error.Unauthorized("Invalid email or password"));

        var twoFactorEnabled = configuration.GetValue<bool>("TwoFactor:Enabled");

        if (!twoFactorEnabled)
        {
            var tokens = await IssueTokensAsync(user, ct);
            return Result.Success(LoginResultDto.WithTokens(tokens));
        }

        // Generate and cache a 6-digit OTP (5 min TTL)
        var code = GenerateCode();
        cache.Set(
            CacheKeyPrefix + user.Email,
            code,
            new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5) });

        await emailService.SendOtpAsync(user.Email, code, ct);

        return Result.Success(LoginResultDto.WithOtp(user.Email));
    }

    private async Task<TokenPairDto> IssueTokensAsync(Domain.UserAuth user, CancellationToken ct)
    {
        var accessToken       = jwtTokenService.GenerateAccessToken(user.Id, user.Email);
        var refreshTokenValue = jwtTokenService.GenerateRefreshToken();
        var expirationDays    = configuration.GetValue<int>("Jwt:RefreshTokenExpirationDays", 7);

        var refreshToken = Domain.RefreshToken.Create(user.Id, refreshTokenValue, expirationDays);
        refreshTokenRepository.Add(refreshToken);
        await unitOfWork.SaveChangesAsync(ct);

        return new TokenPairDto(accessToken.Token, refreshTokenValue, accessToken.ExpiresAt);
    }

    private static string GenerateCode() =>
        Random.Shared.Next(100_000, 999_999).ToString();
}

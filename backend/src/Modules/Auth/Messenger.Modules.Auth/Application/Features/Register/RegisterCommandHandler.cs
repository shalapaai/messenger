namespace Messenger.Modules.Auth.Application.Features.Register;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Modules.Auth.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;

public sealed class RegisterCommandHandler(
    IUserAuthRepository     userRepository,
    IPasswordHasher         passwordHasher,
    IJwtTokenService        jwtTokenService,
    IRefreshTokenRepository refreshTokenRepository,
    IUnitOfWork             unitOfWork,
    IEmailService           emailService,
    IMemoryCache            cache,
    IConfiguration          configuration)
    : ICommandHandler<RegisterCommand, LoginResultDto>
{
    private const string CacheKeyPrefix = "otp:";

    public async Task<Result<LoginResultDto>> Handle(RegisterCommand command, CancellationToken ct)
    {
        var emailExists = await userRepository.ExistsByEmailAsync(command.Email, ct);
        if (emailExists)
            return Result.Failure<LoginResultDto>(Error.Conflict("Auth.EmailAlreadyExists"));

        var passwordHash = passwordHasher.Hash(command.Password);
        var userResult   = UserAuth.Create(command.Email, passwordHash);

        if (userResult.IsFailure)
            return Result.Failure<LoginResultDto>(userResult.Error);

        var user = userResult.Value!;
        userRepository.Add(user);

        var twoFactorEnabled = configuration.GetValue<bool>("TwoFactor:Enabled");

        if (!twoFactorEnabled)
        {
            user.VerifyEmail();
            var tokens = await IssueTokensAsync(user, ct);
            return Result.Success(LoginResultDto.WithTokens(tokens));
        }

        await unitOfWork.SaveChangesAsync(ct);

        var code = GenerateCode();
        cache.Set(
            CacheKeyPrefix + user.Email,
            code,
            new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5) });

        await emailService.SendOtpAsync(user.Email, code, ct);

        return Result.Success(LoginResultDto.WithOtp(user.Email));
    }

    private async Task<TokenPairDto> IssueTokensAsync(UserAuth user, CancellationToken ct)
    {
        var accessToken       = jwtTokenService.GenerateAccessToken(user.Id, user.Email);
        var refreshTokenValue = jwtTokenService.GenerateRefreshToken();
        var expirationDays    = configuration.GetValue<int>("Jwt:RefreshTokenExpirationDays", 7);

        var refreshToken = RefreshToken.Create(user.Id, refreshTokenValue, expirationDays);
        refreshTokenRepository.Add(refreshToken);
        await unitOfWork.SaveChangesAsync(ct);

        return new TokenPairDto(accessToken.Token, refreshTokenValue, accessToken.ExpiresAt);
    }

    private static string GenerateCode() =>
        Random.Shared.Next(100_000, 999_999).ToString();
}

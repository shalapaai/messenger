namespace Messenger.Modules.Auth.Application.Features.Login;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;

public sealed class LoginCommandHandler(
    IUserAuthRepository     userRepository,
    IPasswordHasher         passwordHasher,
    IJwtTokenService        jwtTokenService,
    IRefreshTokenRepository refreshTokenRepository,
    IUnitOfWork             unitOfWork,
    IConfiguration          configuration)
    : ICommandHandler<LoginCommand, LoginResultDto>
{
    public async Task<Result<LoginResultDto>> Handle(LoginCommand command, CancellationToken ct)
    {
        var user = await userRepository.GetByEmailAsync(command.Email, ct);

        if (user is null || !passwordHasher.Verify(command.Password, user.PasswordHash))
            return Result.Failure<LoginResultDto>(Error.Unauthorized("Invalid email or password"));

        var tokens = await IssueTokensAsync(user, ct);
        return Result.Success(LoginResultDto.WithTokens(tokens));
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
}

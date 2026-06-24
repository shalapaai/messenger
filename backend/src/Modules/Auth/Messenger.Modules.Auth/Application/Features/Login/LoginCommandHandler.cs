namespace Messenger.Modules.Auth.Application.Features.Login;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class LoginCommandHandler(
    IUserAuthRepository userRepository,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwtTokenService,
    IRefreshTokenRepository refreshTokenRepository,
    IUnitOfWork unitOfWork)
    : ICommandHandler<LoginCommand, TokenPairDto>
{
    public async Task<Result<TokenPairDto>> Handle(LoginCommand command, CancellationToken ct)
    {
        var user = await userRepository.GetByEmailAsync(command.Email, ct);

        if (user is null || !passwordHasher.Verify(command.Password, user.PasswordHash))
            return Result.Failure<TokenPairDto>(Error.Unauthorized("Invalid email or password"));

        var accessToken = jwtTokenService.GenerateAccessToken(user.Id, user.Email);
        var refreshTokenValue = jwtTokenService.GenerateRefreshToken();

        var refreshToken = Domain.RefreshToken.Create(user.Id, refreshTokenValue, expirationDays: 30);
        refreshTokenRepository.Add(refreshToken);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(new TokenPairDto(
            accessToken.Token,
            refreshTokenValue,
            accessToken.ExpiresAt));
    }
}

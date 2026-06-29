namespace Messenger.Modules.Auth.Application.Features.Register;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Modules.Auth.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;
using Microsoft.Extensions.Configuration;

public sealed class RegisterCommandHandler(
    IUserAuthRepository userRepository,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwtTokenService,
    IRefreshTokenRepository refreshTokenRepository,
    IUnitOfWork unitOfWork,
    IConfiguration configuration)
    : ICommandHandler<RegisterCommand, TokenPairDto>
{
    public async Task<Result<TokenPairDto>> Handle(RegisterCommand command, CancellationToken ct)
    {
        var emailExists = await userRepository.ExistsByEmailAsync(command.Email, ct);
        if (emailExists)
            return Result.Failure<TokenPairDto>(Error.Conflict("Auth.EmailAlreadyExists"));

        var passwordHash = passwordHasher.Hash(command.Password);
        var userResult   = UserAuth.Create(command.Email, passwordHash);

        if (userResult.IsFailure)
            return Result.Failure<TokenPairDto>(userResult.Error);

        var user              = userResult.Value!;
        var accessToken       = jwtTokenService.GenerateAccessToken(user.Id, user.Email);
        var refreshTokenValue = jwtTokenService.GenerateRefreshToken();
        var expirationDays    = configuration.GetValue<int>("Jwt:RefreshTokenExpirationDays", 7);
        var refreshToken      = RefreshToken.Create(user.Id, refreshTokenValue, expirationDays);

        userRepository.Add(user);
        refreshTokenRepository.Add(refreshToken);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(new TokenPairDto(
            accessToken.Token,
            refreshTokenValue,
            accessToken.ExpiresAt));
    }
}

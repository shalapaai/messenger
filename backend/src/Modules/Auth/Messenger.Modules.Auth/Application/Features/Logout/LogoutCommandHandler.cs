namespace Messenger.Modules.Auth.Application.Features.Logout;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class LogoutCommandHandler(
    IRefreshTokenRepository refreshTokenRepository,
    IUnitOfWork unitOfWork)
    : ICommandHandler<LogoutCommand>
{
    public async Task<Result> Handle(LogoutCommand command, CancellationToken ct)
    {
        var token = await refreshTokenRepository.GetByTokenAsync(command.RefreshToken, ct);

        if (token is null || !token.IsActive)
            return Result.Success(); // Idempotent: already revoked or never existed

        token.Revoke();
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}

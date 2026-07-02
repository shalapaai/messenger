namespace Messenger.Modules.Auth.Application.Features.ResetPassword;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;
using Microsoft.Extensions.Caching.Memory;

public sealed class ResetPasswordCommandHandler(
    IUserAuthRepository userRepository,
    IPasswordHasher     passwordHasher,
    IUnitOfWork         unitOfWork,
    IMemoryCache        cache)
    : ICommandHandler<ResetPasswordCommand>
{
    private const string CacheKeyPrefix = "pwd_reset:";

    public async Task<Result> Handle(ResetPasswordCommand command, CancellationToken ct)
    {
        var cacheKey = CacheKeyPrefix + command.Email.ToLowerInvariant();

        if (!cache.TryGetValue<string>(cacheKey, out var storedCode) || storedCode != command.Code)
            return Result.Failure(Error.Unauthorized("Invalid or expired code"));

        cache.Remove(cacheKey);

        var user = await userRepository.GetByEmailAsync(command.Email, ct);
        if (user is null)
            return Result.Failure(Error.Unauthorized("Invalid or expired code"));

        var newHash = passwordHasher.Hash(command.NewPassword);
        user.ChangePassword(newHash);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}

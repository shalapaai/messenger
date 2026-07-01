namespace Messenger.Modules.Auth.Application.Features.ForgotPassword;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;
using Microsoft.Extensions.Caching.Memory;

public sealed class ForgotPasswordCommandHandler(
    IUserAuthRepository userRepository,
    IEmailService       emailService,
    IMemoryCache        cache)
    : ICommandHandler<ForgotPasswordCommand>
{
    private const string CacheKeyPrefix = "pwd_reset:";

    public async Task<Result> Handle(ForgotPasswordCommand command, CancellationToken ct)
    {
        var user = await userRepository.GetByEmailAsync(command.Email, ct);

        // Возвращаем Ok даже если email не найден — не раскрываем существование аккаунта
        if (user is null)
            return Result.Success();

        var code = GenerateCode();
        cache.Set(
            CacheKeyPrefix + user.Email.ToLowerInvariant(),
            code,
            new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5) });

        await emailService.SendPasswordResetAsync(user.Email, code, ct);

        return Result.Success();
    }

    private static string GenerateCode() =>
        Random.Shared.Next(100_000, 999_999).ToString();
}

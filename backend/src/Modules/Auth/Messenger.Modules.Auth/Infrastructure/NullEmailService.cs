namespace Messenger.Modules.Auth.Infrastructure;

using Messenger.Modules.Auth.Application.Abstractions;

public sealed class NullEmailService : IEmailService
{
    public Task SendOtpAsync(string to, string code, CancellationToken ct = default) => Task.CompletedTask;
}

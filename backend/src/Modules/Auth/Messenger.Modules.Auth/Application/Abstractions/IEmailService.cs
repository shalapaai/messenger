namespace Messenger.Modules.Auth.Application.Abstractions;

public interface IEmailService
{
    Task SendOtpAsync(string to, string code, CancellationToken ct = default);
}

namespace Messenger.Modules.Auth.Infrastructure;

using Messenger.Modules.Auth.Application.Abstractions;
using Microsoft.Extensions.Configuration;
using Resend;

public sealed class ResendEmailService(IResend resend, IConfiguration configuration) : IEmailService
{
    public async Task SendOtpAsync(string to, string code, CancellationToken ct = default)
    {
        var from = configuration["Resend:FromEmail"] ?? "onboarding@resend.dev";

        var message = new EmailMessage
        {
            From    = from,
            To      = { to },
            Subject = "Код подтверждения",
            HtmlBody = $"""
                <div style="font-family:sans-serif;max-width:400px;margin:0 auto">
                  <h2 style="color:#2C5BF0">Код подтверждения</h2>
                  <p>Введите этот код для входа в аккаунт:</p>
                  <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111;margin:24px 0">{code}</div>
                  <p style="color:#888;font-size:13px">Код действителен 5 минут. Если вы не запрашивали код — проигнорируйте это письмо.</p>
                </div>
                """,
        };

        await resend.EmailSendAsync(message, ct);
    }
}

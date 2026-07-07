namespace Messenger.Api.Extensions;

using System.Threading.RateLimiting;
using Messenger.Shared.Kernel.Extensions;
using Microsoft.AspNetCore.RateLimiting;

public static class RateLimitingExtensions
{
    // Троттлинг по IP на чувствительных auth-эндпойнтах — без этого login/verify-otp/reset-password
    // можно долбить перебором без каких-либо ограничений (пароль, 6-значный OTP-код, код сброса).
    // "auth" — обычные попытки входа/регистрации, "auth-strict" — узкие окна с секретом, который
    // подбирается перебором (OTP, код сброса пароля).
    public static IServiceCollection AddMessengerRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.AddPolicy("auth", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        Window = TimeSpan.FromMinutes(1),
                        PermitLimit = 10,
                        QueueLimit = 0,
                    }));

            options.AddPolicy("auth-strict", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        Window = TimeSpan.FromMinutes(5),
                        PermitLimit = 5,
                        QueueLimit = 0,
                    }));

            // Эти два — на уже аутентифицированных эндпойнтах, поэтому партиционируем по userId
            // (не по IP): один аккаунт не может обойти лимит сменой IP, а несколько пользователей
            // за одним NAT/офисным IP не делят один и тот же лимит.
            options.AddPolicy("messaging", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: UserIdOrIp(httpContext),
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        Window = TimeSpan.FromSeconds(10),
                        PermitLimit = 20,
                        QueueLimit = 0,
                    }));

            options.AddPolicy("uploads", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: UserIdOrIp(httpContext),
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        Window = TimeSpan.FromMinutes(1),
                        PermitLimit = 10,
                        QueueLimit = 0,
                    }));
        });

        return services;
    }

    private static string UserIdOrIp(HttpContext httpContext) =>
        httpContext.User.Identity?.IsAuthenticated == true
            ? httpContext.GetUserId().ToString()
            : httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}

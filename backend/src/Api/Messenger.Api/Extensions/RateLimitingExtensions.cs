namespace Messenger.Api.Extensions;

using System.Threading.RateLimiting;
using Messenger.Shared.Kernel.Extensions;
using Microsoft.AspNetCore.RateLimiting;

public static class RateLimitingExtensions
{
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

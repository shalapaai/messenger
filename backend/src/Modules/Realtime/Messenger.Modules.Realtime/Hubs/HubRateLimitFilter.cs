namespace Messenger.Modules.Realtime.Hubs;

using System.Threading.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Caching.Memory;

// Встроенный RateLimiting middleware не покрывает вызовы хаб-методов (WebSocket, а не
// отдельные HTTP-запросы) — лимитируем дорогие методы вручную через IHubFilter.
public sealed class HubRateLimitFilter(IMemoryCache cache) : IHubFilter
{
    private static readonly Dictionary<string, (int Permits, TimeSpan Window)> Limits = new()
    {
        [nameof(MessengerHub.SendMessage)] = (20, TimeSpan.FromSeconds(10)),
        [nameof(MessengerHub.StartTyping)] = (30, TimeSpan.FromSeconds(10)),
        [nameof(MessengerHub.StopTyping)]  = (30, TimeSpan.FromSeconds(10)),
    };

    public async ValueTask<object?> InvokeMethodAsync(
        HubInvocationContext invocationContext, Func<HubInvocationContext, ValueTask<object?>> next)
    {
        if (Limits.TryGetValue(invocationContext.HubMethodName, out var limit))
        {
            var userId   = invocationContext.Context.UserIdentifier ?? invocationContext.Context.ConnectionId;
            var cacheKey = $"hub-rl:{invocationContext.HubMethodName}:{userId}";

            // Sliding-expiration в кэше, не статический словарь — неактивные лимитеры вычищаются сами.
            var limiter = cache.GetOrCreate(cacheKey, entry =>
            {
                entry.SlidingExpiration = limit.Window * 2;
                entry.RegisterPostEvictionCallback((_, value, _, _) => (value as RateLimiter)?.Dispose());
                return new FixedWindowRateLimiter(new FixedWindowRateLimiterOptions
                {
                    Window = limit.Window,
                    PermitLimit = limit.Permits,
                    QueueLimit = 0,
                });
            })!;

            using var lease = await limiter.AcquireAsync(1, invocationContext.Context.ConnectionAborted);
            if (!lease.IsAcquired)
                throw new HubException("Too many requests — slow down");
        }

        return await next(invocationContext);
    }
}

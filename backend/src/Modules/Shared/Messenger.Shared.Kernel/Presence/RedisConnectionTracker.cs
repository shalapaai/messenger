namespace Messenger.Shared.Kernel.Presence;

using StackExchange.Redis;

public sealed class RedisConnectionTracker(IConnectionMultiplexer redis) : IConnectionTracker
{
    private static string Key(Guid userId) => $"connections:{userId}";

    // Тот же защитный TTL, что и у RedisPresenceTracker — если инстанс упадёт и
    // OnDisconnectedAsync не выполнится, набор connectionId не должен зависнуть навсегда.
    private static readonly TimeSpan StaleConnectionTtl = TimeSpan.FromHours(24);

    public async Task AddConnectionAsync(Guid userId, string connectionId, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        await db.SetAddAsync(Key(userId), connectionId);
        await db.KeyExpireAsync(Key(userId), StaleConnectionTtl);
    }

    public async Task RemoveConnectionAsync(Guid userId, string connectionId, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        await db.SetRemoveAsync(Key(userId), connectionId);
    }

    public async Task<IReadOnlyList<string>> GetConnectionsAsync(Guid userId, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        var members = await db.SetMembersAsync(Key(userId));
        return members.Select(m => (string)m!).ToList();
    }
}

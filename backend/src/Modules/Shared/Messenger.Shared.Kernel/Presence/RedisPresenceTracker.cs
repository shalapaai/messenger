namespace Messenger.Shared.Kernel.Presence;

using StackExchange.Redis;

public sealed class RedisPresenceTracker(IConnectionMultiplexer redis) : IPresenceTracker
{
    private static string Key(Guid userId) => $"presence:{userId}";

    // Защитный TTL на случай падения/передеплоя инстанса, когда OnDisconnectedAsync для
    // "зависших" соединений так и не выполнится, а декремент никогда не произойдёт —
    // без TTL счётчик остался бы в Redis навсегда. Обновляется при каждом новом
    // подключении, так что для активных пользователей практического значения не имеет.
    private static readonly TimeSpan StaleConnectionTtl = TimeSpan.FromHours(24);

    public async Task<long> ConnectAsync(Guid userId, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        var count = await db.StringIncrementAsync(Key(userId));
        await db.KeyExpireAsync(Key(userId), StaleConnectionTtl);
        return count;
    }

    public async Task<long> DisconnectAsync(Guid userId, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        var count = await db.StringDecrementAsync(Key(userId));
        if (count <= 0)
            await db.KeyDeleteAsync(Key(userId));
        return count;
    }

    public async Task<HashSet<Guid>> GetOnlineAsync(IReadOnlyList<Guid> userIds, CancellationToken ct = default)
    {
        if (userIds.Count == 0)
            return [];

        var db = redis.GetDatabase();
        var batch = db.CreateBatch();
        var tasks = userIds.ToDictionary(id => id, id => batch.KeyExistsAsync(Key(id)));
        batch.Execute();
        await Task.WhenAll(tasks.Values);

        return tasks.Where(kv => kv.Value.Result).Select(kv => kv.Key).ToHashSet();
    }
}

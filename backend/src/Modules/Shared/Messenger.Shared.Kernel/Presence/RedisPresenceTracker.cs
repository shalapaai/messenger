namespace Messenger.Shared.Kernel.Presence;

using StackExchange.Redis;

public sealed class RedisPresenceTracker(IConnectionMultiplexer redis) : IPresenceTracker
{
    private static string Key(Guid userId) => $"presence:{userId}";

    private static readonly TimeSpan StaleConnectionTtl = TimeSpan.FromHours(24);

    public async Task<long> ConnectAsync(Guid userId, string connectionId, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        await db.SetAddAsync(Key(userId), connectionId);
        await db.KeyExpireAsync(Key(userId), StaleConnectionTtl);
        return await db.SetLengthAsync(Key(userId));
    }

    public async Task<long> DisconnectAsync(Guid userId, string connectionId, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        await db.SetRemoveAsync(Key(userId), connectionId);
        return await db.SetLengthAsync(Key(userId));
    }

    public async Task<HashSet<Guid>> GetOnlineAsync(IReadOnlyList<Guid> userIds, CancellationToken ct = default)
    {
        if (userIds.Count == 0)
            return [];

        var db = redis.GetDatabase();
        var batch = db.CreateBatch();
        var tasks = userIds.ToDictionary(id => id, id => batch.SetLengthAsync(Key(id)));
        batch.Execute();
        await Task.WhenAll(tasks.Values);

        return tasks.Where(kv => kv.Value.Result > 0).Select(kv => kv.Key).ToHashSet();
    }

    public async Task<IReadOnlyList<string>> GetConnectionsAsync(Guid userId, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        var members = await db.SetMembersAsync(Key(userId));
        return members.Select(m => (string)m!).ToList();
    }
}

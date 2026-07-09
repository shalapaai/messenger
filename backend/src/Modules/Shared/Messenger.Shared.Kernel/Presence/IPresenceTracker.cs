namespace Messenger.Shared.Kernel.Presence;

public interface IPresenceTracker
{
    Task<long> ConnectAsync(Guid userId, string connectionId, CancellationToken ct = default);
    Task<long> DisconnectAsync(Guid userId, string connectionId, CancellationToken ct = default);
    Task<HashSet<Guid>> GetOnlineAsync(IReadOnlyList<Guid> userIds, CancellationToken ct = default);
    Task<IReadOnlyList<string>> GetConnectionsAsync(Guid userId, CancellationToken ct = default);
}

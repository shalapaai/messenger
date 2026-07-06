namespace Messenger.Shared.Kernel.Presence;

// Обратное отображение "какие SignalR connectionId сейчас есть у этого пользователя" —
// нужно, чтобы принудительно вывести конкретного пользователя из конкретной SignalR-группы
// (например, chat:{id} сразу после исключения из группового чата), а не только разослать
// сообщение через Clients.Group — Groups.RemoveFromGroupAsync принимает connectionId, а не userId.
public interface IConnectionTracker
{
    Task AddConnectionAsync(Guid userId, string connectionId, CancellationToken ct = default);
    Task RemoveConnectionAsync(Guid userId, string connectionId, CancellationToken ct = default);
    Task<IReadOnlyList<string>> GetConnectionsAsync(Guid userId, CancellationToken ct = default);
}

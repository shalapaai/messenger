namespace Messenger.Shared.Kernel.Presence;

// Онлайн-статус пользователя и обратное отображение userId → connectionId живут в одном
// месте: набор активных connectionId. Его размер даёт счётчик подключений/онлайн-статус,
// а сами элементы — connectionId, нужные, чтобы принудительно вывести конкретного
// пользователя из конкретной SignalR-группы (Groups.RemoveFromGroupAsync принимает
// connectionId, а не userId — см. ChatUpdatedEventHandler). Живёт в Shared.Kernel, чтобы
// Realtime (пишет при connect/disconnect) и Chats (читает при GetChats) не зависели друг
// от друга напрямую и не дублировали формат ключа Redis.
public interface IPresenceTracker
{
    /// <summary>Регистрирует новое подключение пользователя. Возвращает количество активных подключений ПОСЛЕ добавления.</summary>
    Task<long> ConnectAsync(Guid userId, string connectionId, CancellationToken ct = default);

    /// <summary>Убирает закрытое подключение пользователя. Возвращает количество активных подключений ПОСЛЕ удаления.</summary>
    Task<long> DisconnectAsync(Guid userId, string connectionId, CancellationToken ct = default);

    /// <summary>Какие из переданных пользователей сейчас онлайн (есть хотя бы одно активное подключение).</summary>
    Task<HashSet<Guid>> GetOnlineAsync(IReadOnlyList<Guid> userIds, CancellationToken ct = default);

    /// <summary>Все текущие connectionId пользователя — для принудительного вывода из SignalR-групп.</summary>
    Task<IReadOnlyList<string>> GetConnectionsAsync(Guid userId, CancellationToken ct = default);
}

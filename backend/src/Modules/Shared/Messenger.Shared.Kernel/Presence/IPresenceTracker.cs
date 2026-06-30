namespace Messenger.Shared.Kernel.Presence;

// Низкоуровневый факт "подключён ли пользователь по WebSocket прямо сейчас" —
// общая инфраструктура, а не бизнес-логика конкретного модуля. Живёт в Shared.Kernel,
// чтобы Realtime (пишет при connect/disconnect) и Chats (читает при GetChats) не
// зависели друг от друга напрямую и не дублировали формат ключа Redis.
public interface IPresenceTracker
{
    /// <summary>Засчитывает новое подключение пользователя. Возвращает количество активных подключений ПОСЛЕ инкремента.</summary>
    Task<long> ConnectAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Засчитывает закрытие подключения пользователя. Возвращает количество активных подключений ПОСЛЕ декремента.</summary>
    Task<long> DisconnectAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Какие из переданных пользователей сейчас онлайн (есть хотя бы одно активное подключение).</summary>
    Task<HashSet<Guid>> GetOnlineAsync(IReadOnlyList<Guid> userIds, CancellationToken ct = default);
}

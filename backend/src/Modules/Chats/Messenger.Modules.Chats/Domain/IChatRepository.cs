namespace Messenger.Modules.Chats.Domain;

public interface IChatRepository
{
    Task<Chat?> GetByIdAsync(ChatId id, CancellationToken ct = default);
    Task<Guid?> FindDirectChatIdAsync(Guid userId1, Guid userId2, CancellationToken ct = default);
    Task<List<Chat>> GetByUserIdAsync(Guid userId, CancellationToken ct = default);
    /// <summary>Лёгкая EXISTS-проверка по составному ключу (chat_id, user_id) — без загрузки агрегата.</summary>
    Task<bool> IsMemberAsync(ChatId chatId, Guid userId, CancellationToken ct = default);
    void Add(Chat chat);
    void Delete(Chat chat);
}

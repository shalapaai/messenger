namespace Messenger.Modules.Chats.Domain;

public interface IChatRepository
{
    Task<Chat?> GetByIdAsync(ChatId id, CancellationToken ct = default);
    Task<Guid?> FindDirectChatIdAsync(Guid userId1, Guid userId2, CancellationToken ct = default);
    Task<List<Chat>> GetByUserIdAsync(Guid userId, CancellationToken ct = default);
    Task<bool> IsMemberAsync(ChatId chatId, Guid userId, CancellationToken ct = default);
    Task<bool> IsModeratorAsync(ChatId chatId, Guid userId, CancellationToken ct = default);
    void Add(Chat chat);
    void Delete(Chat chat);
}

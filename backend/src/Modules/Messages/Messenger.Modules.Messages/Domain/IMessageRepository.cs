namespace Messenger.Modules.Messages.Domain;

public interface IMessageRepository
{
    Task<Message?> GetByIdAsync(MessageId id, CancellationToken ct = default);
    Task<List<Message>> GetByIdsAsync(IEnumerable<MessageId> ids, CancellationToken ct = default);
    Task<List<Message>> GetByChatIdCursorAsync(Guid chatId, Guid? before, int limit, CancellationToken ct = default);
    Task<int> CountByChatIdAsync(Guid chatId, CancellationToken ct = default);
    void Add(Message message);
    void Update(Message message);
}

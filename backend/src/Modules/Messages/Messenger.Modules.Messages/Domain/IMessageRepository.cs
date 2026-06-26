namespace Messenger.Modules.Messages.Domain;

using Messenger.Shared.Kernel.Pagination;

public interface IMessageRepository
{
    Task<Message?> GetByIdAsync(MessageId id, CancellationToken ct = default);
    Task<PagedList<Message>> GetByChatIdAsync(Guid chatId, int page, int pageSize, CancellationToken ct = default);
    Task<List<Message>> GetByChatIdCursorAsync(Guid chatId, Guid? before, int limit, CancellationToken ct = default);
    Task<int> CountByChatIdAsync(Guid chatId, CancellationToken ct = default);
    void Add(Message message);
    void Update(Message message);
}

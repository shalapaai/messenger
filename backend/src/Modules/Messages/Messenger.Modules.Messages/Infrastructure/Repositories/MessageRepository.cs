namespace Messenger.Modules.Messages.Infrastructure.Repositories;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Pagination;
using Microsoft.EntityFrameworkCore;

public sealed class MessageRepository(MessagesDbContext dbContext) : IMessageRepository
{
    public async Task<Message?> GetByIdAsync(MessageId id, CancellationToken ct = default) =>
        await dbContext.Messages.FirstOrDefaultAsync(m => m.Id == id, ct);

    public async Task<PagedList<Message>> GetByChatIdAsync(
        Guid chatId, int page, int pageSize, CancellationToken ct = default)
    {
        var query = dbContext.Messages
            .Where(m => m.ChatId == chatId && m.Status != MessageStatus.Deleted)
            .OrderByDescending(m => m.SentAt);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedList<Message>(items, page, pageSize, totalCount);
    }

    public async Task<int> CountByChatIdAsync(Guid chatId, CancellationToken ct = default) =>
        await dbContext.Messages.CountAsync(m => m.ChatId == chatId, ct);

    public void Add(Message message) => dbContext.Messages.Add(message);
    public void Update(Message message) => dbContext.Messages.Update(message);
}

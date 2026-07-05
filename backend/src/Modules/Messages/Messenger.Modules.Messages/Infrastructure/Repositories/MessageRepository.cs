namespace Messenger.Modules.Messages.Infrastructure.Repositories;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Pagination;
using Microsoft.EntityFrameworkCore;

public sealed class MessageRepository(MessagesDbContext dbContext) : IMessageRepository
{
    public async Task<Message?> GetByIdAsync(MessageId id, CancellationToken ct = default) =>
        await dbContext.Messages.FirstOrDefaultAsync(m => m.Id == id, ct);

    public async Task<List<Message>> GetByIdsAsync(IEnumerable<MessageId> ids, CancellationToken ct = default) =>
        await dbContext.Messages.Where(m => ids.Contains(m.Id)).ToListAsync(ct);

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

    public async Task<List<Message>> GetByChatIdCursorAsync(
        Guid chatId, Guid? before, int limit, CancellationToken ct = default)
    {
        var query = dbContext.Messages
            .Where(m => m.ChatId == chatId && m.Status != MessageStatus.Deleted);

        if (before is not null)
        {
            var cursor = await dbContext.Messages
                .Where(m => m.Id == MessageId.From(before.Value))
                .Select(m => new { m.SentAt, Id = m.Id.Value })
                .FirstOrDefaultAsync(ct);

            // Тай-брейк по Id: сравнение только по SentAt при одинаковой метке времени у нескольких
            // сообщений (обычное дело при массовой вставке — пересылка, история и т.п.) на границе
            // страницы либо теряет, либо задваивает сообщения с точно таким же SentAt, что у курсора.
            if (cursor is not null)
                query = query.Where(m =>
                    m.SentAt < cursor.SentAt ||
                    (m.SentAt == cursor.SentAt && m.Id.Value < cursor.Id));
        }

        return await query
            .OrderByDescending(m => m.SentAt)
            .ThenByDescending(m => m.Id.Value)
            .Take(limit)
            .ToListAsync(ct);
    }

    public void Add(Message message) => dbContext.Messages.Add(message);
    public void Update(Message message) => dbContext.Messages.Update(message);
}

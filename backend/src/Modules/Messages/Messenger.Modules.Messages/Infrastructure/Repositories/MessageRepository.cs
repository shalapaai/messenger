namespace Messenger.Modules.Messages.Infrastructure.Repositories;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Pagination;
using Microsoft.EntityFrameworkCore;

public sealed class MessageRepository(MessagesDbContext dbContext) : IMessageRepository
{
    public async Task<Message?> GetByIdAsync(MessageId id, CancellationToken ct = default) =>
        await dbContext.Messages
            .Include(m => m.Reactions)
            .FirstOrDefaultAsync(m => m.Id == id, ct);

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
            .Include(m => m.Reactions)
            .Where(m => m.ChatId == chatId && m.Status != MessageStatus.Deleted);

        if (before is not null)
        {
            // Курсор ищем ТОЛЬКО внутри этого же чата — иначе участник чата A мог бы
            // передать id чужого сообщения из чата B (в котором не состоит) и по ответу
            // узнать, что оно существует и его точный SentAt (утечка через тайминг).
            var cursorSequence = await dbContext.Messages
                .Where(m => m.Id == MessageId.From(before.Value) && m.ChatId == chatId)
                .Select(m => (long?)m.Sequence)
                .FirstOrDefaultAsync(ct);

            // Сортируем/фильтруем по Sequence (монотонный DB identity), а не по SentAt —
            // несколько сообщений могут иметь одинаковый SentAt (например, при пересылке
            // пачки сообщений подряд), из-за чего чистая сортировка по времени может
            // пропустить или задвоить сообщение на границе страницы.
            if (cursorSequence is not null)
                query = query.Where(m => m.Sequence < cursorSequence);
        }

        return await query
            .OrderByDescending(m => m.Sequence)
            .Take(limit)
            .ToListAsync(ct);
    }

    public void Add(Message message) => dbContext.Messages.Add(message);
    public void Update(Message message) => dbContext.Messages.Update(message);
}

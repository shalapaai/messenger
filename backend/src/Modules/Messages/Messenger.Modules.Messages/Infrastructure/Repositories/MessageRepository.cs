namespace Messenger.Modules.Messages.Infrastructure.Repositories;

using Messenger.Modules.Messages.Domain;
using Microsoft.EntityFrameworkCore;

public sealed class MessageRepository(MessagesDbContext dbContext) : IMessageRepository
{
    public async Task<Message?> GetByIdAsync(MessageId id, CancellationToken ct = default) =>
        await dbContext.Messages
            .Include(m => m.Reactions)
            .FirstOrDefaultAsync(m => m.Id == id, ct);

    public async Task<List<Message>> GetByIdsAsync(IEnumerable<MessageId> ids, CancellationToken ct = default) =>
        await dbContext.Messages.Where(m => ids.Contains(m.Id)).ToListAsync(ct);

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
            // Курсор ищем только внутри этого же чата — иначе можно узнать про существование
            // и SentAt чужого сообщения из чата, в котором не состоишь (утечка через тайминг).
            var cursorSequence = await dbContext.Messages
                .Where(m => m.Id == MessageId.From(before.Value) && m.ChatId == chatId)
                .Select(m => (long?)m.Sequence)
                .FirstOrDefaultAsync(ct);

            // Sequence, а не SentAt — несколько сообщений могут получить одинаковый SentAt
            // (пересылка пачкой), и сортировка по времени может пропустить/задвоить на границе страницы.
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

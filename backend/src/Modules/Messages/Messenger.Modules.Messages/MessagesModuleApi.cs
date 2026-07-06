namespace Messenger.Modules.Messages;

using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

// Реализация публичного API модуля — вызывается другими модулями через IMessagesModule
internal sealed class MessagesModuleApi(
    Infrastructure.MessagesDbContext dbContext,
    IMessageRepository messageRepository)
    : IMessagesModule
{
    public async Task<Result<int>> GetMessageCountInChatAsync(Guid chatId, CancellationToken ct = default)
    {
        var count = await messageRepository.CountByChatIdAsync(chatId, ct);
        return Result.Success(count);
    }

    public async Task<Result> DeleteAllMessagesInChatAsync(Guid chatId, CancellationToken ct = default)
    {
        await dbContext.Messages
            .Where(m => m.ChatId == chatId)
            .ExecuteDeleteAsync(ct);

        return Result.Success();
    }

    public async Task<Result<Dictionary<Guid, LastMessageDto>>> GetLastMessagesByChatIdsAsync(
        IReadOnlyList<Guid> chatIds, CancellationToken ct = default)
    {
        if (chatIds.Count == 0)
            return Result.Success(new Dictionary<Guid, LastMessageDto>());

        var messages = await dbContext.Messages
            .Where(m => chatIds.Contains(m.ChatId) && m.Status != MessageStatus.Deleted)
            .GroupBy(m => m.ChatId)
            .Select(g => g.OrderByDescending(m => m.Sequence).First())
            .ToListAsync(ct);

        var dict = messages.ToDictionary(
            m => m.ChatId,
            m =>
            {
                var firstAttachment = m.Attachments.OrderBy(a => a.SortOrder).FirstOrDefault();
                return new LastMessageDto(
                    m.Id.Value, m.SenderId, m.Content, m.SentAt,
                    m.Attachments.Count > 0, firstAttachment?.FileUrl, firstAttachment?.ContentType,
                    firstAttachment?.FileName);
            });

        return Result.Success(dict);
    }

    public async Task<Result<Dictionary<Guid, MessagePreviewDto>>> GetMessagePreviewsByIdsAsync(
        IReadOnlyList<Guid> messageIds, CancellationToken ct = default)
    {
        if (messageIds.Count == 0)
            return Result.Success(new Dictionary<Guid, MessagePreviewDto>());

        var ids = messageIds.Select(MessageId.From).ToList();
        var messages = await messageRepository.GetByIdsAsync(ids, ct);

        var dict = messages.ToDictionary(
            m => m.Id.Value,
            m => new MessagePreviewDto(m.Id.Value, m.SenderId, m.Content, m.Status == MessageStatus.Deleted));

        return Result.Success(dict);
    }

    public async Task<Result<Dictionary<Guid, int>>> GetUnreadCountsByChatIdsAsync(
        Guid userId, IReadOnlyDictionary<Guid, DateTime?> lastReadAtByChatId, CancellationToken ct = default)
    {
        if (lastReadAtByChatId.Count == 0)
            return Result.Success(new Dictionary<Guid, int>());

        var chatIds = lastReadAtByChatId.Keys.ToList();

        // Самая ранняя точка отсчёта среди всех чатов — всё, что отправлено раньше нeё,
        // прочитано гарантированно везде, можно не тянуть из БД вовсе. Если хотя бы один
        // чат ещё ни разу не читали (null) — нижнюю границу поставить нельзя, читаем всё.
        DateTime? earliestSince = lastReadAtByChatId.Values.Any(v => v is null)
            ? null
            : lastReadAtByChatId.Values.Min();

        var query = dbContext.Messages
            .Where(m => chatIds.Contains(m.ChatId) && m.SenderId != userId && m.Status != MessageStatus.Deleted);

        if (earliestSince is not null)
            query = query.Where(m => m.SentAt > earliestSince);

        var candidates = await query
            .Select(m => new { m.ChatId, m.SentAt })
            .ToListAsync(ct);

        var result = chatIds.ToDictionary(
            id => id,
            id =>
            {
                var since = lastReadAtByChatId[id];
                return candidates.Count(m => m.ChatId == id && (since is null || m.SentAt > since));
            });

        return Result.Success(result);
    }
}

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
                    firstAttachment?.FileName, m.Kind.ToString());
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

        // Чаты, которые ещё ни разу не читали (null), нуждаются в полной истории — для них
        // нижнюю границу поставить нельзя. Но остальные чаты всё равно можно отсечь по
        // самой ранней ИЗ ИЗВЕСТНЫХ точек отсчёта — не тянуть из БД заведомо прочитанное
        // даже тогда, когда среди чатов есть один-два "непрочитанных ни разу".
        var neverReadChatIds = lastReadAtByChatId
            .Where(kv => kv.Value is null)
            .Select(kv => kv.Key)
            .ToHashSet();
        var knownSinceValues = lastReadAtByChatId.Values.Where(v => v is not null).ToList();
        DateTime? earliestKnownSince = knownSinceValues.Count > 0 ? knownSinceValues.Min() : null;

        var query = dbContext.Messages
            .Where(m => chatIds.Contains(m.ChatId) && m.SenderId != userId && m.Status != MessageStatus.Deleted);

        if (earliestKnownSince is not null)
            query = query.Where(m => neverReadChatIds.Contains(m.ChatId) || m.SentAt > earliestKnownSince);

        var candidates = await query
            .Select(m => new { m.ChatId, m.SentAt })
            .ToListAsync(ct);

        // Один линейный проход вместо пересчёта Count() по всему candidates для каждого чата.
        var countsByChat = candidates
            .Where(m => lastReadAtByChatId[m.ChatId] is not { } since || m.SentAt > since)
            .GroupBy(m => m.ChatId)
            .ToDictionary(g => g.Key, g => g.Count());

        var result = chatIds.ToDictionary(id => id, id => countsByChat.GetValueOrDefault(id));

        return Result.Success(result);
    }

    public async Task<Result<Guid>> CreateSystemMessageAsync(
        Guid chatId, Guid actorUserId, Guid targetUserId, SystemEventType eventType, CancellationToken ct = default)
    {
        var message = Message.CreateSystem(chatId, actorUserId, targetUserId, eventType);
        messageRepository.Add(message);
        await dbContext.SaveChangesAsync(ct);
        return Result.Success(message.Id.Value);
    }
}

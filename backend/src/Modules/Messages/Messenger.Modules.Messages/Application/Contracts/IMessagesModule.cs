namespace Messenger.Modules.Messages.Application.Contracts;

using Messenger.Shared.Kernel.Results;

public sealed record LastMessageDto(
    Guid     MessageId,
    Guid     SenderId,
    string   Content,
    DateTime SentAt,
    // Для превью в списке чатов: сообщение без текста, но с вложением (например, фото без
    // подписи) не должно выглядеть как "нет сообщений" — фронт показывает мини-превью и
    // подпись по типу вложения вместо этого.
    bool     HasAttachments,
    string?  FirstAttachmentUrl,
    string?  FirstAttachmentContentType,
    string?  FirstAttachmentFileName);

public sealed record MessagePreviewDto(
    Guid   MessageId,
    Guid   SenderId,
    string Content,
    bool   IsDeleted);

// Общее правило обрезки текста цитаты — используется и в реалтайм-рассылке (MessageSentEventHandler),
// и при отдаче истории (GetMessagesQueryHandler), чтобы reply-превью не отличалось в зависимости
// от того, получил клиент сообщение по WebSocket или подгрузил историю через REST.
public static class MessagePreview
{
    public const int MaxLength = 120;

    public static string Truncate(string content) =>
        content.Length <= MaxLength ? content : content[..MaxLength] + "…";
}

// Публичный API модуля для межмодульного взаимодействия.
// Chats или Notifications вызывают этот интерфейс — не зависят от внутренностей модуля.
public interface IMessagesModule
{
    Task<Result<int>>                          GetMessageCountInChatAsync(Guid chatId, CancellationToken ct = default);
    Task<Result>                               DeleteAllMessagesInChatAsync(Guid chatId, CancellationToken ct = default);
    Task<Result<Dictionary<Guid, LastMessageDto>>> GetLastMessagesByChatIdsAsync(IReadOnlyList<Guid> chatIds, CancellationToken ct = default);
    // Для карточки цитирования в realtime-ответе на сообщение (Realtime → payload "replyTo...")
    Task<Result<Dictionary<Guid, MessagePreviewDto>>> GetMessagePreviewsByIdsAsync(IReadOnlyList<Guid> messageIds, CancellationToken ct = default);
    // Количество непрочитанных (не своих, не удалённых) сообщений на чат — lastReadAtByChatId
    // передаёт СВОЙ (вызывающего пользователя) last_read_at по каждому чату; null означает
    // "ещё ни разу не читал", тогда unread = все чужие сообщения в чате.
    Task<Result<Dictionary<Guid, int>>> GetUnreadCountsByChatIdsAsync(
        Guid userId, IReadOnlyDictionary<Guid, DateTime?> lastReadAtByChatId, CancellationToken ct = default);
}

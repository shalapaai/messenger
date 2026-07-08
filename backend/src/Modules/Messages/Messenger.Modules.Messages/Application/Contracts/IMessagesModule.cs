namespace Messenger.Modules.Messages.Application.Contracts;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Results;

public sealed record LastMessageDto(
    Guid     MessageId,
    Guid     SenderId,
    string   Content,
    DateTime SentAt,
    // Для превью в списке чатов: сообщение без текста, но с вложением не должно выглядеть как "нет сообщений".
    bool     HasAttachments,
    string?  FirstAttachmentUrl,
    string?  FirstAttachmentContentType,
    string?  FirstAttachmentFileName,
    // "System" — фронт показывает generic-заглушку вместо Content (тот не переведён и не
    // предназначен для отображения, см. Message.CreateSystem)
    string   Kind);

public sealed record MessagePreviewDto(
    Guid   MessageId,
    Guid   SenderId,
    string Content,
    bool   IsDeleted);

// Общее правило обрезки, чтобы reply-превью совпадало в realtime и в REST-истории.
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
    // Непрочитанные (не свои, не удалённые) на чат; null в lastReadAtByChatId = "ещё не читал",
    // тогда unread = все чужие сообщения в чате.
    Task<Result<Dictionary<Guid, int>>> GetUnreadCountsByChatIdsAsync(
        Guid userId, IReadOnlyDictionary<Guid, DateTime?> lastReadAtByChatId, CancellationToken ct = default);
    // actorUserId — кто выполнил действие (ушедший для MemberLeft), targetUserId — кого добавили/удалили.
    Task<Result<Guid>> CreateSystemMessageAsync(
        Guid chatId, Guid actorUserId, Guid targetUserId, SystemEventType eventType, CancellationToken ct = default);
}

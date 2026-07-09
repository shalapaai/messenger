namespace Messenger.Modules.Messages.Application.Contracts;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Results;

public sealed record LastMessageDto(
    Guid     MessageId,
    Guid     SenderId,
    string   Content,
    DateTime SentAt,
    bool     HasAttachments,
    string?  FirstAttachmentUrl,
    string?  FirstAttachmentContentType,
    string?  FirstAttachmentFileName,
    string   Kind);

public sealed record MessagePreviewDto(
    Guid   MessageId,
    Guid   SenderId,
    string Content,
    bool   IsDeleted);

public static class MessagePreview
{
    public const int MaxLength = 120;

    public static string Truncate(string content) =>
        content.Length <= MaxLength ? content : content[..MaxLength] + "…";
}

public interface IMessagesModule
{
    Task<Result<int>>                          GetMessageCountInChatAsync(Guid chatId, CancellationToken ct = default);
    Task<Result>                               DeleteAllMessagesInChatAsync(Guid chatId, CancellationToken ct = default);
    Task<Result<Dictionary<Guid, LastMessageDto>>> GetLastMessagesByChatIdsAsync(IReadOnlyList<Guid> chatIds, CancellationToken ct = default);
    Task<Result<Dictionary<Guid, MessagePreviewDto>>> GetMessagePreviewsByIdsAsync(IReadOnlyList<Guid> messageIds, CancellationToken ct = default);
    Task<Result<Dictionary<Guid, int>>> GetUnreadCountsByChatIdsAsync(
        Guid userId, IReadOnlyDictionary<Guid, DateTime?> lastReadAtByChatId, CancellationToken ct = default);
    Task<Result<Guid>> CreateSystemMessageAsync(
        Guid chatId, Guid actorUserId, Guid targetUserId, SystemEventType eventType, CancellationToken ct = default);
}

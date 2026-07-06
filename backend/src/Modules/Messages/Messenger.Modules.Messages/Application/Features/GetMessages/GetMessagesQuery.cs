namespace Messenger.Modules.Messages.Application.Features.GetMessages;

using Messenger.Shared.Kernel.Abstractions;

public sealed record GetMessagesQuery(
    Guid  ChatId,
    Guid  CurrentUserId,
    Guid? Before,
    int   Limit = 50) : IQuery<MessagesPageDto>;

public sealed record MessagesPageDto(
    List<MessageDto> Items,
    Guid?            NextCursor);

public sealed record AttachmentDto(
    string FileUrl,
    string FileName,
    string ContentType,
    long   FileSizeBytes);

public sealed record MessageDto(
    Guid      Id,
    Guid      ChatId,
    Guid      SenderId,
    string    SenderName,
    string?   SenderAvatarUrl,
    string    SenderAvatarColor,
    string    Content,
    List<AttachmentDto> Attachments,
    string    Status,
    DateTime  SentAt,
    DateTime? EditedAt,
    Guid?     ReplyToMessageId,
    string?   ReplyToSenderName,
    string?   ReplyToContent,
    Guid?     ForwardedFromUserId,
    string?   ForwardedFromUserName,
    string    Kind,
    string?   SystemEventType,
    Guid?     TargetUserId,
    string?   TargetUserName);

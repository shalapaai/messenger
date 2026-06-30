namespace Messenger.Modules.Messages.Application.Features.GetMessages;

using Messenger.Shared.Kernel.Abstractions;

public sealed record GetMessagesQuery(
    Guid  ChatId,
    Guid? Before,
    int   Limit = 50) : IQuery<MessagesPageDto>;

public sealed record MessagesPageDto(
    List<MessageDto> Items,
    Guid?            NextCursor);

public sealed record MessageDto(
    Guid      Id,
    Guid      ChatId,
    Guid      SenderId,
    string    SenderName,
    string?   SenderAvatarUrl,
    string    Content,
    string?   FileUrl,
    string    Status,
    DateTime  SentAt,
    DateTime? EditedAt,
    Guid?     ReplyToMessageId);

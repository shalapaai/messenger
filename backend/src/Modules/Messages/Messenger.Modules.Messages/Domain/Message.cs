namespace Messenger.Modules.Messages.Domain;

using Messenger.Modules.Messages.Domain.Events;
using Messenger.Shared.Kernel.Primitives;
using Messenger.Shared.Kernel.Results;

public sealed class Message : AggregateRoot<MessageId>
{
    private Message() { } // EF Core

    private Message(MessageId id, Guid chatId, Guid senderId, string content, Guid? replyToMessageId)
        : base(id)
    {
        ChatId = chatId;
        SenderId = senderId;
        Content = content;
        ReplyToMessageId = replyToMessageId;
        Status = MessageStatus.Sent;
        SentAt = DateTime.UtcNow;
    }

    public Guid ChatId { get; private set; }
    public Guid SenderId { get; private set; }
    public string Content { get; private set; } = string.Empty;
    public string? FileUrl { get; private set; }
    public string? FileName { get; private set; }
    public string? FileContentType { get; private set; }
    public long? FileSizeBytes { get; private set; }
    public MessageStatus Status { get; private set; }
    public DateTime SentAt { get; private set; }
    public DateTime? EditedAt { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public Guid? ReplyToMessageId { get; private set; }
    public Guid? ForwardedFromMessageId { get; private set; }
    public Guid? ForwardedFromUserId { get; private set; }

    public static Result<Message> Create(Guid chatId, Guid senderId, string content, Guid? replyToMessageId = null)
    {
        if (string.IsNullOrWhiteSpace(content))
            return Result.Failure<Message>(Error.Validation("Content", "Message content cannot be empty"));

        if (content.Length > 4096)
            return Result.Failure<Message>(Error.Validation("Content", "Message content exceeds 4096 characters"));

        var message = new Message(MessageId.New(), chatId, senderId, content.Trim(), replyToMessageId);
        message.RaiseDomainEvent(new MessageSentDomainEvent(
            message.Id.Value, chatId, senderId, content, replyToMessageId: replyToMessageId));
        return Result.Success(message);
    }

    public static Result<Message> CreateFile(
        Guid chatId, Guid senderId, string fileUrl, string fileName, string contentType, long fileSizeBytes, string? caption = null)
    {
        if (string.IsNullOrWhiteSpace(fileUrl))
            return Result.Failure<Message>(Error.Validation("FileUrl", "File URL cannot be empty"));

        var message = new Message(MessageId.New(), chatId, senderId, caption?.Trim() ?? string.Empty, null)
        {
            FileUrl         = fileUrl,
            FileName        = fileName,
            FileContentType = contentType,
            FileSizeBytes   = fileSizeBytes,
        };
        message.RaiseDomainEvent(new MessageSentDomainEvent(
            message.Id.Value, chatId, senderId, message.Content,
            fileUrl: fileUrl, fileName: fileName, fileContentType: contentType, fileSizeBytes: fileSizeBytes));
        return Result.Success(message);
    }

    // Пересланное сообщение — новая независимая копия в целевом чате, автор которой (SenderId) —
    // тот, кто переслал, а не оригинальный отправитель. ForwardedFrom* только для подписи "Переслано от"
    // на клиенте: редактирование/удаление копии подчиняется тем же правилам, что у обычного сообщения.
    // Файловые поля копируются из оригинала целиком (не только URL) — иначе пересылка файла/фото
    // без подписи теряла бы вложение (пустой Content без fileUrl не проходил бы валидацию и копия
    // молча дропалась), а без имени/типа/размера получатель не смог бы красиво отрендерить карточку файла.
    public static Result<Message> CreateForwarded(
        Guid targetChatId, Guid forwarderId, string content,
        string? fileUrl, string? fileName, string? fileContentType, long? fileSizeBytes,
        Guid originalMessageId, Guid originalSenderId)
    {
        if (string.IsNullOrWhiteSpace(content) && string.IsNullOrWhiteSpace(fileUrl))
            return Result.Failure<Message>(Error.Validation("Content", "Message content cannot be empty"));

        var message = new Message(MessageId.New(), targetChatId, forwarderId, content.Trim(), null)
        {
            FileUrl                = fileUrl,
            FileName               = fileName,
            FileContentType        = fileContentType,
            FileSizeBytes          = fileSizeBytes,
            ForwardedFromMessageId = originalMessageId,
            ForwardedFromUserId    = originalSenderId,
        };
        message.RaiseDomainEvent(new MessageSentDomainEvent(
            message.Id.Value, targetChatId, forwarderId, message.Content, originalMessageId, originalSenderId,
            fileUrl: fileUrl, fileName: fileName, fileContentType: fileContentType, fileSizeBytes: fileSizeBytes));
        return Result.Success(message);
    }

    public Result Edit(Guid requesterId, string newContent)
    {
        if (SenderId != requesterId)
            return Result.Failure(Error.Forbidden("Only the sender can edit this message"));

        if (Status == MessageStatus.Deleted)
            return Result.Failure(new Error("Message.Deleted", "Cannot edit a deleted message"));

        if (string.IsNullOrWhiteSpace(newContent))
            return Result.Failure(Error.Validation("Content", "New content cannot be empty"));

        Content = newContent.Trim();
        EditedAt = DateTime.UtcNow;
        RaiseDomainEvent(new MessageEditedDomainEvent(Id.Value, ChatId, newContent));
        return Result.Success();
    }

    // Удалить может любой участник чата, не только автор — членство в чате
    // проверяется на уровне обработчика команды (см. DeleteMessageCommandHandler)
    public Result Delete()
    {
        if (Status == MessageStatus.Deleted)
            return Result.Failure(new Error("Message.AlreadyDeleted", "Message is already deleted"));

        Status = MessageStatus.Deleted;
        Content = string.Empty;
        DeletedAt = DateTime.UtcNow;
        RaiseDomainEvent(new MessageDeletedDomainEvent(Id.Value, ChatId));
        return Result.Success();
    }

    public void MarkAsDelivered()
    {
        if (Status == MessageStatus.Sent)
            Status = MessageStatus.Delivered;
    }

    public void MarkAsRead()
    {
        if (Status is MessageStatus.Sent or MessageStatus.Delivered)
            Status = MessageStatus.Read;
    }
}

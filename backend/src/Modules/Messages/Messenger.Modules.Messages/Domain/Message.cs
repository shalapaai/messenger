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

    public static Result<Message> CreateFile(Guid chatId, Guid senderId, string fileUrl, string? caption = null)
    {
        if (string.IsNullOrWhiteSpace(fileUrl))
            return Result.Failure<Message>(Error.Validation("FileUrl", "File URL cannot be empty"));

        var message = new Message(MessageId.New(), chatId, senderId, caption?.Trim() ?? string.Empty, null);
        message.FileUrl = fileUrl;
        message.RaiseDomainEvent(new MessageSentDomainEvent(message.Id.Value, chatId, senderId, caption ?? string.Empty));
        return Result.Success(message);
    }

    // Пересланное сообщение — новая независимая копия в целевом чате, автор которой (SenderId) —
    // тот, кто переслал, а не оригинальный отправитель. ForwardedFrom* только для подписи "Переслано от"
    // на клиенте: редактирование/удаление копии подчиняется тем же правилам, что у обычного сообщения.
    public static Result<Message> CreateForwarded(
        Guid targetChatId, Guid forwarderId, string content, Guid originalMessageId, Guid originalSenderId)
    {
        if (string.IsNullOrWhiteSpace(content))
            return Result.Failure<Message>(Error.Validation("Content", "Message content cannot be empty"));

        var message = new Message(MessageId.New(), targetChatId, forwarderId, content.Trim(), null)
        {
            ForwardedFromMessageId = originalMessageId,
            ForwardedFromUserId    = originalSenderId,
        };
        message.RaiseDomainEvent(new MessageSentDomainEvent(
            message.Id.Value, targetChatId, forwarderId, message.Content, originalMessageId, originalSenderId));
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

namespace Messenger.Modules.Messages.Domain;

using Messenger.Modules.Messages.Domain.Events;
using Messenger.Shared.Kernel.Primitives;
using Messenger.Shared.Kernel.Results;

public sealed class Message : AggregateRoot<MessageId>
{
    public const int MaxAttachmentsPerMessage = 10;

    private readonly List<MessageAttachment> _attachments = [];

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

    // DB identity, монотонно возрастающий — тай-брейкер к SentAt для курсорной пагинации
    // (несколько сообщений могут получить один SentAt при пересылке пачкой).
    public long Sequence { get; private set; }

    public Guid ChatId { get; private set; }
    public Guid SenderId { get; private set; }
    public string Content { get; private set; } = string.Empty;
    public IReadOnlyList<MessageAttachment> Attachments => _attachments;
    public MessageStatus Status { get; private set; }
    public DateTime SentAt { get; private set; }
    public DateTime? EditedAt { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public Guid? ReplyToMessageId { get; private set; }
    public Guid? ForwardedFromMessageId { get; private set; }
    public Guid? ForwardedFromUserId { get; private set; }
    public MessageKind Kind { get; private set; } = MessageKind.Text;
    public SystemEventType? SystemEventType { get; private set; }
    /// <summary>Только для Kind == System — кого именно добавили/удалили/кто вышел (SenderId
    /// при этом — тот, кто выполнил действие: сам ушедший для MemberLeft, админ для остальных).</summary>
    public Guid? TargetUserId { get; private set; }

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

    // Один и тот же путь для одного файла и для батча: без вложений отправить нельзя,
    // caption необязателен и относится ко всему сообщению, а не к конкретному файлу.
    public static Result<Message> CreateWithAttachments(
        Guid chatId, Guid senderId, IReadOnlyList<MessageAttachment> attachments, string? caption = null)
    {
        if (attachments.Count == 0)
            return Result.Failure<Message>(Error.Validation("Attachments", "At least one file is required"));

        if (attachments.Count > MaxAttachmentsPerMessage)
            return Result.Failure<Message>(Error.Validation("Attachments", $"Cannot attach more than {MaxAttachmentsPerMessage} files to a single message"));

        var message = new Message(MessageId.New(), chatId, senderId, caption?.Trim() ?? string.Empty, null);
        message._attachments.AddRange(attachments);
        message.RaiseDomainEvent(new MessageSentDomainEvent(
            message.Id.Value, chatId, senderId, message.Content, attachments: attachments));
        return Result.Success(message);
    }

    // Независимая копия в целевом чате; SenderId — тот, кто переслал, ForwardedFrom* — только для
    // подписи "Переслано от". Вложения копируются с новыми Id — owned-сущность нельзя делить между родителями.
    public static Result<Message> CreateForwarded(
        Guid targetChatId, Guid forwarderId, string content, IReadOnlyList<MessageAttachment> attachments,
        Guid originalMessageId, Guid originalSenderId)
    {
        if (string.IsNullOrWhiteSpace(content) && attachments.Count == 0)
            return Result.Failure<Message>(Error.Validation("Content", "Message content cannot be empty"));

        var clonedAttachments = attachments
            .Select(a => MessageAttachment.Create(a.FileUrl, a.FileName, a.ContentType, a.FileSizeBytes, a.SortOrder))
            .ToList();

        var message = new Message(MessageId.New(), targetChatId, forwarderId, content.Trim(), null)
        {
            ForwardedFromMessageId = originalMessageId,
            ForwardedFromUserId    = originalSenderId,
        };
        message._attachments.AddRange(clonedAttachments);
        message.RaiseDomainEvent(new MessageSentDomainEvent(
            message.Id.Value, targetChatId, forwarderId, message.Content, originalMessageId, originalSenderId,
            attachments: clonedAttachments));
        return Result.Success(message);
    }

    // Системное сообщение о смене состава группы (добавили/вышел/удалили) — Content не показывается
    // пользователю напрямую (клиент строит локализованный текст из Kind/SystemEventType/TargetUserId),
    // но должен быть непустым: колонка content в БД NOT NULL, как и у обычных сообщений.
    public static Message CreateSystem(Guid chatId, Guid actorUserId, Guid targetUserId, SystemEventType eventType)
    {
        var message = new Message(MessageId.New(), chatId, actorUserId, $"system:{eventType}", null)
        {
            Kind = MessageKind.System,
            SystemEventType = eventType,
            TargetUserId = targetUserId,
        };
        message.RaiseDomainEvent(new MessageSentDomainEvent(
            message.Id.Value, chatId, actorUserId, message.Content,
            kind: MessageKind.System, systemEventType: eventType, targetUserId: targetUserId));
        return message;
    }

    public Result Edit(Guid requesterId, string newContent)
    {
        if (SenderId != requesterId)
            return Result.Failure(Error.Forbidden("Only the sender can edit this message"));

        if (Status == MessageStatus.Deleted)
            return Result.Failure(new Error("Message.Deleted", "Cannot edit a deleted message"));

        if (string.IsNullOrWhiteSpace(newContent))
            return Result.Failure(Error.Validation("Content", "New content cannot be empty"));

        if (newContent.Length > 4096)
            return Result.Failure(Error.Validation("Content", "Message content exceeds 4096 characters"));

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

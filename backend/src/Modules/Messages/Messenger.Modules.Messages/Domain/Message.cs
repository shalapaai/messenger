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

    // Монотонно возрастающий идентификатор вставки (DB identity) — используется ТОЛЬКО для
    // курсорной пагинации как тай-брейкер к SentAt. Несколько сообщений могут получить
    // одинаковый SentAt (например, быстрый цикл вставок при пересылке нескольких сообщений
    // сразу — см. ForwardMessagesCommandHandler), и сортировка по одному только SentAt в
    // таком случае может пропустить или задвоить сообщение на границе страницы.
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

    // Одно сообщение может нести несколько вложений — отправлены ли они одним выбором файлов
    // в чате или это единственный файл, путь один и тот же: без вложений отправить нельзя,
    // подпись (caption) необязательна и относится ко всему сообщению целиком, а не к файлу
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

    // Пересланное сообщение — новая независимая копия в целевом чате, автор которой (SenderId) —
    // тот, кто переслал, а не оригинальный отправитель. ForwardedFrom* только для подписи "Переслано от"
    // на клиенте: редактирование/удаление копии подчиняется тем же правилам, что у обычного сообщения.
    // Вложения копируются целиком (новые MessageAttachment с новыми Id — owned-сущность нельзя
    // разделить между двумя родителями), иначе пересылка файла без подписи теряла бы вложение
    // (пустой Content без вложений не проходил бы валидацию и копия молча дропалась).
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

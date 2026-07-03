namespace Messenger.Modules.Messages.Domain.Events;

using Messenger.Shared.Kernel.Primitives;

public sealed record MessageSentDomainEvent(
    Guid Id,
    DateTime OccurredOn,
    Guid MessageId,
    Guid ChatId,
    Guid SenderId,
    string Content,
    Guid? ForwardedFromMessageId,
    Guid? ForwardedFromUserId,
    Guid? ReplyToMessageId,
    IReadOnlyList<MessageAttachment> Attachments) : IDomainEvent
{
    public MessageSentDomainEvent(
        Guid messageId, Guid chatId, Guid senderId, string content,
        Guid? forwardedFromMessageId = null, Guid? forwardedFromUserId = null, Guid? replyToMessageId = null,
        IReadOnlyList<MessageAttachment>? attachments = null)
        : this(Guid.NewGuid(), DateTime.UtcNow, messageId, chatId, senderId, content,
               forwardedFromMessageId, forwardedFromUserId, replyToMessageId,
               attachments ?? []) { }
}

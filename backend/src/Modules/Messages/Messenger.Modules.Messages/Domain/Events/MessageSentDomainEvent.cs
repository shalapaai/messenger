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
    IReadOnlyList<MessageAttachment> Attachments,
    MessageKind Kind,
    SystemEventType? SystemEventType,
    Guid? TargetUserId,
    IReadOnlyList<PollOption> PollOptions) : IDomainEvent
{
    public MessageSentDomainEvent(
        Guid messageId, Guid chatId, Guid senderId, string content,
        Guid? forwardedFromMessageId = null, Guid? forwardedFromUserId = null, Guid? replyToMessageId = null,
        IReadOnlyList<MessageAttachment>? attachments = null,
        MessageKind kind = MessageKind.Text,
        SystemEventType? systemEventType = null,
        Guid? targetUserId = null,
        IReadOnlyList<PollOption>? pollOptions = null)
        : this(Guid.NewGuid(), DateTime.UtcNow, messageId, chatId, senderId, content,
               forwardedFromMessageId, forwardedFromUserId, replyToMessageId,
               attachments ?? [], kind, systemEventType, targetUserId, pollOptions ?? []) { }
}

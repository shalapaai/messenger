namespace Messenger.Modules.Messages.Domain.Events;

using Messenger.Shared.Kernel.Primitives;

public sealed record MessageSentDomainEvent(
    Guid Id,
    DateTime OccurredOn,
    Guid MessageId,
    Guid ChatId,
    Guid SenderId,
    string Content) : IDomainEvent
{
    public MessageSentDomainEvent(Guid messageId, Guid chatId, Guid senderId, string content)
        : this(Guid.NewGuid(), DateTime.UtcNow, messageId, chatId, senderId, content) { }
}

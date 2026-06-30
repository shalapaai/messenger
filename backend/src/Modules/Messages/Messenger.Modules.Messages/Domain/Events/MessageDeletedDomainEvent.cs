namespace Messenger.Modules.Messages.Domain.Events;

using Messenger.Shared.Kernel.Primitives;

public sealed record MessageDeletedDomainEvent(
    Guid Id,
    DateTime OccurredOn,
    Guid MessageId,
    Guid ChatId) : IDomainEvent
{
    public MessageDeletedDomainEvent(Guid messageId, Guid chatId)
        : this(Guid.NewGuid(), DateTime.UtcNow, messageId, chatId) { }
}

namespace Messenger.Modules.Messages.Domain.Events;

using Messenger.Shared.Kernel.Primitives;

public sealed record MessageEditedDomainEvent(
    Guid Id,
    DateTime OccurredOn,
    Guid MessageId,
    Guid ChatId,
    string NewContent) : IDomainEvent
{
    public MessageEditedDomainEvent(Guid messageId, Guid chatId, string newContent)
        : this(Guid.NewGuid(), DateTime.UtcNow, messageId, chatId, newContent) { }
}

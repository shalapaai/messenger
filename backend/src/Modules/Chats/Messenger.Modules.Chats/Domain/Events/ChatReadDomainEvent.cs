namespace Messenger.Modules.Chats.Domain.Events;

using Messenger.Shared.Kernel.Primitives;

public sealed record ChatReadDomainEvent(
    Guid Id,
    DateTime OccurredOn,
    Guid ChatId,
    Guid ReaderId,
    DateTime ReadAt) : IDomainEvent
{
    public ChatReadDomainEvent(Guid chatId, Guid readerId, DateTime readAt)
        : this(Guid.NewGuid(), DateTime.UtcNow, chatId, readerId, readAt) { }
}

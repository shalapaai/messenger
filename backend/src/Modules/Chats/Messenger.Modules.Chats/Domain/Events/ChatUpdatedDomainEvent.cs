namespace Messenger.Modules.Chats.Domain.Events;

using Messenger.Shared.Kernel.Primitives;

public sealed record ChatUpdatedDomainEvent(
    Guid Id,
    DateTime OccurredOn,
    Guid ChatId,
    IReadOnlyList<Guid> AffectedUserIds) : IDomainEvent
{
    public ChatUpdatedDomainEvent(Guid chatId, IReadOnlyList<Guid> affectedUserIds)
        : this(Guid.NewGuid(), DateTime.UtcNow, chatId, affectedUserIds) { }
}

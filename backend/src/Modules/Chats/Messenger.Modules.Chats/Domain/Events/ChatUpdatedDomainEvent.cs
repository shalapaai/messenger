namespace Messenger.Modules.Chats.Domain.Events;

using Messenger.Shared.Kernel.Primitives;

/// <summary>Чат создан / состав участников изменился / изменилось название или аватар —
/// сигнал клиентам обновить список чатов и, если открыта, карточку группы.</summary>
public sealed record ChatUpdatedDomainEvent(
    Guid Id,
    DateTime OccurredOn,
    Guid ChatId,
    IReadOnlyList<Guid> AffectedUserIds) : IDomainEvent
{
    public ChatUpdatedDomainEvent(Guid chatId, IReadOnlyList<Guid> affectedUserIds)
        : this(Guid.NewGuid(), DateTime.UtcNow, chatId, affectedUserIds) { }
}

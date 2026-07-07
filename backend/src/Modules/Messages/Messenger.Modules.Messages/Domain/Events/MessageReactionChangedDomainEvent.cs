namespace Messenger.Modules.Messages.Domain.Events;

using Messenger.Shared.Kernel.Primitives;

public sealed record MessageReactionChangedDomainEvent(
    Guid Id,
    DateTime OccurredOn,
    Guid MessageId,
    Guid ChatId,
    Guid UserId,
    string? Emoji) : IDomainEvent
{
    public MessageReactionChangedDomainEvent(Guid messageId, Guid chatId, Guid userId, string? emoji)
        : this(Guid.NewGuid(), DateTime.UtcNow, messageId, chatId, userId, emoji) { }
}

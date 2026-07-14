namespace Messenger.Modules.Messages.Domain.Events;

using Messenger.Shared.Kernel.Primitives;

public sealed record PollVoteChangedDomainEvent(
    Guid Id,
    DateTime OccurredOn,
    Guid MessageId,
    Guid ChatId,
    Guid UserId,
    Guid? OptionId) : IDomainEvent
{
    public PollVoteChangedDomainEvent(Guid messageId, Guid chatId, Guid userId, Guid? optionId)
        : this(Guid.NewGuid(), DateTime.UtcNow, messageId, chatId, userId, optionId) { }
}

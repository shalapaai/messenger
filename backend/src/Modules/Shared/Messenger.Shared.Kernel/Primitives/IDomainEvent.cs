namespace Messenger.Shared.Kernel.Primitives;

using MediatR;

public interface IDomainEvent : INotification
{
    Guid Id { get; }
    DateTime OccurredOn { get; }
}

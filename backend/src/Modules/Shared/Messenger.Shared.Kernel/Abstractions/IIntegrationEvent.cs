namespace Messenger.Shared.Kernel.Abstractions;

// Контракт для событий между модулями (in-process или через брокер при выносе в микросервисы)
public interface IIntegrationEvent
{
    Guid Id { get; }
    DateTime OccurredOn { get; }
}

public abstract record IntegrationEvent : IIntegrationEvent
{
    public Guid Id { get; } = Guid.NewGuid();
    public DateTime OccurredOn { get; } = DateTime.UtcNow;
}

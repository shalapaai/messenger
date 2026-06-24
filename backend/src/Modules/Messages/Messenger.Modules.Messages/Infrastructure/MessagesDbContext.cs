namespace Messenger.Modules.Messages.Infrastructure;

using MediatR;
using Messenger.Modules.Messages.Application;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Primitives;
using Microsoft.EntityFrameworkCore;

public sealed class MessagesDbContext(
    DbContextOptions<MessagesDbContext> options,
    IMediator mediator)
    : DbContext(options), IUnitOfWork
{
    public DbSet<Message> Messages => Set<Message>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("messages");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(MessagesDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        // Публикуем доменные события ПОСЛЕ записи в БД — гарантируем консистентность
        var aggregates = ChangeTracker
            .Entries<AggregateRoot<MessageId>>()
            .Where(e => e.Entity.DomainEvents.Any())
            .Select(e => e.Entity)
            .ToList();

        var domainEvents = aggregates.SelectMany(a => a.DomainEvents).ToList();
        aggregates.ForEach(a => a.ClearDomainEvents());

        var result = await base.SaveChangesAsync(ct);

        foreach (var @event in domainEvents)
            await mediator.Publish(@event, ct);

        return result;
    }
}

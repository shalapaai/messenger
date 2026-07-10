namespace Messenger.Modules.Chats.Infrastructure;

using MediatR;
using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Primitives;
using Microsoft.EntityFrameworkCore;

public sealed class ChatsDbContext(DbContextOptions<ChatsDbContext> options, IMediator mediator)
    : DbContext(options), IUnitOfWork
{
    public DbSet<Chat> Chats => Set<Chat>();
    public DbSet<ChatMember> Members => Set<ChatMember>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("chats");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ChatsDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var aggregates = ChangeTracker
            .Entries<AggregateRoot<ChatId>>()
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

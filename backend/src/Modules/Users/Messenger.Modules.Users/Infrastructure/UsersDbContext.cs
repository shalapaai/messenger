namespace Messenger.Modules.Users.Infrastructure;

using MediatR;
using Messenger.Modules.Users.Application.Abstractions;
using Messenger.Modules.Users.Domain;
using Messenger.Shared.Kernel.Primitives;
using Microsoft.EntityFrameworkCore;

public sealed class UsersDbContext(DbContextOptions<UsersDbContext> options, IMediator mediator)
    : DbContext(options), IUnitOfWork
{
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("users");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(UsersDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var aggregates = ChangeTracker
            .Entries<AggregateRoot<Guid>>()
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

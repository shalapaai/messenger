namespace Messenger.Modules.Users.Infrastructure;

using Messenger.Modules.Users.Application.Abstractions;
using Messenger.Modules.Users.Domain;
using Microsoft.EntityFrameworkCore;

public sealed class UsersDbContext(DbContextOptions<UsersDbContext> options)
    : DbContext(options), IUnitOfWork
{
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("users");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(UsersDbContext).Assembly);
    }
}

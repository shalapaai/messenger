namespace Messenger.Modules.Chats.Infrastructure;

using Microsoft.EntityFrameworkCore;

public sealed class ChatsDbContext(DbContextOptions<ChatsDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("chats");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ChatsDbContext).Assembly);
    }
}

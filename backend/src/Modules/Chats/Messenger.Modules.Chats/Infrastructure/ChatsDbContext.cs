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

        modelBuilder.Entity<Chat>(b =>
        {
            b.HasKey(c => c.Id);
            b.Property(c => c.Id)
                .HasColumnName("id")
                .HasConversion(id => id.Value, value => ChatId.From(value))
                .ValueGeneratedNever();
            b.Property(c => c.Type)
                .HasColumnName("type")
                .HasConversion(v => v.ToString().ToLower(), v => Enum.Parse<ChatType>(v, true))
                .HasMaxLength(10).IsRequired();
            b.Property(c => c.Name)
                .HasColumnName("name")
                .HasMaxLength(100);
            b.Property(c => c.AvatarUrl)
                .HasColumnName("avatar_url");
            b.Property(c => c.AvatarColor)
                .HasColumnName("avatar_color")
                .HasMaxLength(7);
            b.Property(c => c.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();
            b.Property(c => c.DirectUserId1)
                .HasColumnName("direct_user_id_1");
            b.Property(c => c.DirectUserId2)
                .HasColumnName("direct_user_id_2");
            b.HasMany(c => c.Members)
                .WithOne()
                .HasForeignKey(m => m.ChatId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(c => new { c.DirectUserId1, c.DirectUserId2 })
                .IsUnique()
                .HasFilter("type = 'direct'")
                .HasDatabaseName("ux_chats_direct_pair");

            b.ToTable("chats");
        });

        modelBuilder.Entity<ChatMember>(b =>
        {
            b.HasKey(m => new { m.ChatId, m.UserId });
            b.Property(m => m.ChatId)
                .HasColumnName("chat_id")
                .HasConversion(id => id.Value, value => ChatId.From(value))
                .IsRequired();
            b.Property(m => m.UserId)
                .HasColumnName("user_id")
                .IsRequired();
            b.Property(m => m.Role)
                .HasColumnName("role")
                .HasConversion(v => v.ToString().ToLower(), v => Enum.Parse<ChatMemberRole>(v, true))
                .HasMaxLength(10)
                .IsRequired();
            b.Property(m => m.JoinedAt)
                .HasColumnName("joined_at")
                .IsRequired();
            b.Property(m => m.LastReadAt)
                .HasColumnName("last_read_at");
            b.HasIndex(m => m.UserId)
                .HasDatabaseName("idx_chats_members_user_id");
            b.ToTable("members");
        });
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

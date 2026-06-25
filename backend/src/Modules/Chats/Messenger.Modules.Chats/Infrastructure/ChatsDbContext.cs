namespace Messenger.Modules.Chats.Infrastructure;

using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Domain;
using Microsoft.EntityFrameworkCore;

public sealed class ChatsDbContext(DbContextOptions<ChatsDbContext> options)
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
            b.Property(c => c.Name).HasColumnName("name").HasMaxLength(100);
            b.Property(c => c.AvatarUrl).HasColumnName("avatar_url");
            b.Property(c => c.CreatedAt).HasColumnName("created_at").IsRequired();
            b.HasMany(c => c.Members).WithOne().HasForeignKey(m => m.ChatId).OnDelete(DeleteBehavior.Cascade);
            b.ToTable("chats");
        });

        modelBuilder.Entity<ChatMember>(b =>
        {
            b.HasKey(m => new { m.ChatId, m.UserId });
            b.Property(m => m.ChatId)
                .HasColumnName("chat_id")
                .HasConversion(id => id.Value, value => ChatId.From(value))
                .IsRequired();
            b.Property(m => m.UserId).HasColumnName("user_id").IsRequired();
            b.Property(m => m.Role)
                .HasColumnName("role")
                .HasConversion(v => v.ToString().ToLower(), v => Enum.Parse<ChatMemberRole>(v, true))
                .HasMaxLength(10).IsRequired();
            b.Property(m => m.JoinedAt).HasColumnName("joined_at").IsRequired();
            b.HasIndex(m => m.UserId).HasDatabaseName("idx_chats_members_user_id");
            b.ToTable("members");
        });
    }
}

namespace Messenger.Modules.Chats.Infrastructure.Persistence.Configurations;

using Messenger.Modules.Chats.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public sealed class ChatMemberConfiguration : IEntityTypeConfiguration<ChatMember>
{
    public void Configure(EntityTypeBuilder<ChatMember> b)
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
    }
}

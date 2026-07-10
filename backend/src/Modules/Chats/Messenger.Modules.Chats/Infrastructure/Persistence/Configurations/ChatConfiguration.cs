namespace Messenger.Modules.Chats.Infrastructure.Persistence.Configurations;

using Messenger.Modules.Chats.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public sealed class ChatConfiguration : IEntityTypeConfiguration<Chat>
{
    public void Configure(EntityTypeBuilder<Chat> b)
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

        // Не даёт двум параллельным запросам создать два direct-чата для одной пары (TOCTOU);
        // пара хранится прямо на Chat, а не индексом по members, где её не выразить без агрегатного запроса.
        b.HasIndex(c => new { c.DirectUserId1, c.DirectUserId2 })
            .IsUnique()
            .HasFilter("type = 'direct'")
            .HasDatabaseName("ux_chats_direct_pair");

        b.ToTable("chats");
    }
}

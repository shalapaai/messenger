namespace Messenger.Modules.Messages.Infrastructure.Persistence.Configurations;

using Messenger.Modules.Messages.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public sealed class MessageConfiguration : IEntityTypeConfiguration<Message>
{
    public void Configure(EntityTypeBuilder<Message> builder)
    {
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id)
            .HasConversion(id => id.Value, value => MessageId.From(value))
            .ValueGeneratedNever();

        builder.Property(m => m.Content)
            .HasMaxLength(4096)
            .IsRequired();

        builder.Property(m => m.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(m => m.ChatId).IsRequired();
        builder.Property(m => m.SenderId).IsRequired();
        builder.Property(m => m.SentAt).IsRequired();
        builder.Property(m => m.EditedAt);
        builder.Property(m => m.DeletedAt);
        builder.Property(m => m.ReplyToMessageId);

        // Составной индекс для пагинации по чату (самый частый запрос)
        builder.HasIndex(m => new { m.ChatId, m.SentAt }).HasDatabaseName("ix_messages_chat_id_sent_at");
        builder.HasIndex(m => m.SenderId).HasDatabaseName("ix_messages_sender_id");

        builder.ToTable("messages");
    }
}

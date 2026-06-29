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
            .HasColumnName("id")
            .HasConversion(id => id.Value, value => MessageId.From(value))
            .ValueGeneratedNever();

        builder.Property(m => m.Content)
            .HasColumnName("content")
            .HasMaxLength(4096)
            .IsRequired();

        builder.Property(m => m.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(m => m.ChatId).HasColumnName("chat_id").IsRequired();
        builder.Property(m => m.SenderId).HasColumnName("sender_id").IsRequired();
        builder.Property(m => m.SentAt).HasColumnName("sent_at").IsRequired();
        builder.Property(m => m.EditedAt).HasColumnName("edited_at");
        builder.Property(m => m.DeletedAt).HasColumnName("deleted_at");
        builder.Property(m => m.ReplyToMessageId).HasColumnName("reply_to_message_id");
        builder.Property(m => m.FileUrl).HasColumnName("file_url").HasMaxLength(2048);

        builder.HasIndex(m => new { m.ChatId, m.SentAt }).HasDatabaseName("ix_message_chat_id_sent_at");
        builder.HasIndex(m => m.SenderId).HasDatabaseName("ix_message_sender_id");

        builder.ToTable("message");
    }
}

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

        builder.Property(m => m.Sequence)
            .HasColumnName("sequence")
            .UseIdentityAlwaysColumn();

        builder.HasAlternateKey(m => m.Sequence);

        // Оптимистичная блокировка через системную колонку Postgres xmin (не требует своей миграции) —
        // при конфликте параллельного редактирования EF Core бросает DbUpdateConcurrencyException.
        builder.Property<uint>("xmin")
            .HasColumnName("xmin")
            .IsRowVersion();

        builder.Property(m => m.ChatId).HasColumnName("chat_id").IsRequired();
        builder.Property(m => m.SenderId).HasColumnName("sender_id").IsRequired();
        builder.Property(m => m.SentAt).HasColumnName("sent_at").IsRequired();
        builder.Property(m => m.EditedAt).HasColumnName("edited_at");
        builder.Property(m => m.DeletedAt).HasColumnName("deleted_at");
        builder.Property(m => m.ReplyToMessageId).HasColumnName("reply_to_message_id");
        builder.Property(m => m.ForwardedFromMessageId).HasColumnName("forwarded_from_message_id");
        builder.Property(m => m.ForwardedFromUserId).HasColumnName("forwarded_from_user_id");

        builder.Property(m => m.Kind)
            .HasColumnName("message_type")
            .HasConversion<string>()
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(m => m.SystemEventType)
            .HasColumnName("system_event_type")
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(m => m.TargetUserId).HasColumnName("target_user_id");

        builder.Navigation(m => m.Attachments).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.OwnsMany(m => m.Attachments, a =>
        {
            a.ToTable("message_attachment");
            a.WithOwner().HasForeignKey("message_id");

            a.HasKey(x => x.Id);
            a.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            a.Property(x => x.FileUrl).HasColumnName("file_url").HasMaxLength(2048).IsRequired();
            a.Property(x => x.FileName).HasColumnName("file_name").HasMaxLength(255).IsRequired();
            a.Property(x => x.ContentType).HasColumnName("content_type").HasMaxLength(100).IsRequired();
            a.Property(x => x.FileSizeBytes).HasColumnName("file_size_bytes").IsRequired();
            a.Property(x => x.SortOrder).HasColumnName("sort_order").IsRequired();

            a.HasIndex("message_id").HasDatabaseName("ix_message_attachment_message_id");
        });

        builder.HasIndex(m => new { m.ChatId, m.SentAt }).HasDatabaseName("ix_message_chat_id_sent_at");
        builder.HasIndex(m => new { m.ChatId, m.Sequence }).HasDatabaseName("ix_message_chat_id_sequence");
        builder.HasIndex(m => m.SenderId).HasDatabaseName("ix_message_sender_id");

        builder.ToTable("message");
    }
}

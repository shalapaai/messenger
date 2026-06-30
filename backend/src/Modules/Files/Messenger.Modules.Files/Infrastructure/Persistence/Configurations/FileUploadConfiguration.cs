namespace Messenger.Modules.Files.Infrastructure.Persistence.Configurations;

using Messenger.Modules.Files.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public sealed class FileUploadConfiguration : IEntityTypeConfiguration<FileUpload>
{
    public void Configure(EntityTypeBuilder<FileUpload> builder)
    {
        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).HasColumnName("id");
        builder.Property(f => f.FileKey).HasColumnName("file_key").HasMaxLength(512).IsRequired();
        builder.Property(f => f.OriginalName).HasColumnName("original_name").HasMaxLength(255).IsRequired();
        builder.Property(f => f.ContentType).HasColumnName("content_type").HasMaxLength(100).IsRequired();
        builder.Property(f => f.SizeBytes).HasColumnName("size_bytes").IsRequired();
        builder.Property(f => f.UploadedBy).HasColumnName("uploaded_by").IsRequired();
        builder.Property(f => f.UploadedAt).HasColumnName("uploaded_at").IsRequired();
        builder.Property(f => f.Category).HasColumnName("category").HasConversion<string>().HasMaxLength(30);
        builder.Property(f => f.ChatId).HasColumnName("chat_id");

        builder.HasIndex(f => f.FileKey).IsUnique().HasDatabaseName("ix_file_upload_file_key");
        builder.HasIndex(f => new { f.UploadedBy, f.Category })
               .HasDatabaseName("ix_file_upload_uploaded_by_category");

        builder.ToTable("file_upload");
    }
}

namespace Messenger.Modules.Files.Infrastructure.Persistence.Configurations;

using Messenger.Modules.Files.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public sealed class FileUploadConfiguration : IEntityTypeConfiguration<FileUpload>
{
    public void Configure(EntityTypeBuilder<FileUpload> builder)
    {
        builder.HasKey(f => f.Id);
        builder.Property(f => f.FileKey).HasMaxLength(512).IsRequired();
        builder.Property(f => f.OriginalName).HasMaxLength(255).IsRequired();
        builder.Property(f => f.ContentType).HasMaxLength(100).IsRequired();
        builder.Property(f => f.SizeBytes).IsRequired();
        builder.Property(f => f.UploadedBy).IsRequired();
        builder.Property(f => f.UploadedAt).IsRequired();
        builder.Property(f => f.Category).HasConversion<string>().HasMaxLength(30);

        builder.HasIndex(f => f.FileKey).IsUnique().HasDatabaseName("ix_file_uploads_file_key");
        // Индекс для поиска аватара пользователя
        builder.HasIndex(f => new { f.UploadedBy, f.Category })
               .HasDatabaseName("ix_file_uploads_uploaded_by_category");

        builder.ToTable("file_uploads");
    }
}

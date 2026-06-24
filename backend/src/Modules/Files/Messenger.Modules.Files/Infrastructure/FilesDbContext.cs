namespace Messenger.Modules.Files.Infrastructure;

using Messenger.Modules.Files.Application;
using Messenger.Modules.Files.Domain;
using Microsoft.EntityFrameworkCore;

public sealed class FilesDbContext(DbContextOptions<FilesDbContext> options)
    : DbContext(options), IUnitOfWork
{
    public DbSet<FileUpload> FileUploads => Set<FileUpload>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("files");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(FilesDbContext).Assembly);
    }
}

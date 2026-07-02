namespace Messenger.Modules.Files.Infrastructure.Repositories;

using Messenger.Modules.Files.Domain;
using Microsoft.EntityFrameworkCore;

public sealed class FileRepository(FilesDbContext dbContext) : IFileRepository
{
    public async Task<FileUpload?> GetByKeyAsync(string fileKey, CancellationToken ct = default) =>
        await dbContext.FileUploads.FirstOrDefaultAsync(f => f.FileKey == fileKey, ct);

    public async Task<FileUpload?> GetAvatarByUserIdAsync(Guid userId, CancellationToken ct = default) =>
        await dbContext.FileUploads
            .Where(f => f.UploadedBy == userId && f.Category == FileCategory.Avatar)
            .OrderByDescending(f => f.UploadedAt)
            .FirstOrDefaultAsync(ct);

    public async Task<FileUpload?> GetGroupAvatarByChatIdAsync(Guid chatId, CancellationToken ct = default) =>
        await dbContext.FileUploads
            .Where(f => f.ChatId == chatId && f.Category == FileCategory.GroupAvatar)
            .OrderByDescending(f => f.UploadedAt)
            .FirstOrDefaultAsync(ct);

    public void Add(FileUpload file)    => dbContext.FileUploads.Add(file);
    public void Remove(FileUpload file) => dbContext.FileUploads.Remove(file);
}

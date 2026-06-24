namespace Messenger.Modules.Files.Domain;

public interface IFileRepository
{
    Task<FileUpload?> GetByKeyAsync(string fileKey, CancellationToken ct = default);
    Task<FileUpload?> GetAvatarByUserIdAsync(Guid userId, CancellationToken ct = default);
    void Add(FileUpload file);
    void Remove(FileUpload file);
}

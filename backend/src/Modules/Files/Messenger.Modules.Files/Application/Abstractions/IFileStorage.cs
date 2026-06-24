namespace Messenger.Modules.Files.Application.Abstractions;

// Абстракция хранилища. Dev → LocalFileStorage, Prod → S3FileStorage.
// Смена провайдера: только изменить DI-регистрацию в FilesModule.cs.
public interface IFileStorage
{
    Task<FileUploadResult> UploadAsync(
        Stream content, string fileName, string contentType, CancellationToken ct = default);

    Task<Stream> DownloadAsync(string fileKey, CancellationToken ct = default);

    Task DeleteAsync(string fileKey, CancellationToken ct = default);

    // Возвращает URL для клиента — для Local это /api/files/{key}, для S3 — CDN URL
    string GetPublicUrl(string fileKey);
}

public sealed record FileUploadResult(string FileKey, string PublicUrl, long SizeBytes);

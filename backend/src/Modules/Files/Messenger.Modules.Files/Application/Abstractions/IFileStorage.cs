namespace Messenger.Modules.Files.Application.Abstractions;

public interface IFileStorage
{
    Task<FileUploadResult> UploadAsync(
        Stream content, string fileName, string contentType, CancellationToken ct = default);

    Task<Stream> DownloadAsync(string fileKey, CancellationToken ct = default);

    Task DeleteAsync(string fileKey, CancellationToken ct = default);

    string GetPublicUrl(string fileKey);
}

public sealed record FileUploadResult(string FileKey, string PublicUrl, long SizeBytes);

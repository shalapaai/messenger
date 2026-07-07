namespace Messenger.Modules.Files.Infrastructure.Storage;

using Amazon.S3;
using Amazon.S3.Transfer;
using Messenger.Modules.Files.Application.Abstractions;
using Microsoft.Extensions.Options;

// Prod-реализация. Включить через FileStorage:Type=S3 в appsettings.
// Пакет: AWSSDK.S3
public sealed class S3FileStorage(IAmazonS3 s3Client, IOptions<S3StorageOptions> options) : IFileStorage
{
    private readonly S3StorageOptions _opts = options.Value;

    public async Task<FileUploadResult> UploadAsync(
        Stream content, string fileName, string contentType, CancellationToken ct = default)
    {
        var ext     = Path.GetExtension(fileName).ToLowerInvariant();
        var fileKey = $"{DateTime.UtcNow:yyyy/MM/dd}/{Guid.NewGuid():N}{ext}";

        var request = new TransferUtilityUploadRequest
        {
            BucketName  = _opts.BucketName,
            Key         = fileKey,
            InputStream = content,
            ContentType = contentType,
            CannedACL   = S3CannedACL.Private
        };

        var utility = new TransferUtility(s3Client);
        await utility.UploadAsync(request, ct);

        return new FileUploadResult(fileKey, GetPublicUrl(fileKey), content.Length);
    }

    public async Task<Stream> DownloadAsync(string fileKey, CancellationToken ct = default)
    {
        var response = await s3Client.GetObjectAsync(_opts.BucketName, fileKey, ct);
        return response.ResponseStream;
    }

    public async Task DeleteAsync(string fileKey, CancellationToken ct = default) =>
        await s3Client.DeleteObjectAsync(_opts.BucketName, fileKey, ct);

    // ВАЖНО: намеренно НЕ прямой URL на бакет/CDN. Объект приватный (CannedACL.Private),
    // а прямая ссылка на CloudFront/бакет обходила бы проверку членства в чате из
    // FilesEndpoints.DownloadFile — тот же путь, что и для LocalFileStorage, единственное
    // место, отдающее вложения чата, чтобы у Local/S3 было одинаковое поведение доступа.
    public string GetPublicUrl(string fileKey) => $"/api/files/{fileKey}";
}

public sealed class S3StorageOptions
{
    public const string SectionName = "FileStorage:S3";
    public string BucketName { get; set; } = string.Empty;
    public string Region     { get; set; } = "eu-central-1";
}

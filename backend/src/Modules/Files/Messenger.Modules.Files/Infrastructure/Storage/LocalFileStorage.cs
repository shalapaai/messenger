namespace Messenger.Modules.Files.Infrastructure.Storage;

using Messenger.Modules.Files.Application.Abstractions;
using Microsoft.Extensions.Options;

public sealed class LocalFileStorage(IOptions<LocalStorageOptions> options) : IFileStorage
{
    private readonly LocalStorageOptions _opts = options.Value;

    public async Task<FileUploadResult> UploadAsync(
        Stream content, string fileName, string contentType, CancellationToken ct = default)
    {
        Directory.CreateDirectory(_opts.BasePath);

        var ext     = Path.GetExtension(fileName).ToLowerInvariant();
        var fileKey = $"{Guid.NewGuid():N}{ext}";
        var path    = Path.Combine(_opts.BasePath, fileKey);

        await using var fs = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true);
        await content.CopyToAsync(fs, ct);

        return new FileUploadResult(fileKey, GetPublicUrl(fileKey), fs.Length);
    }

    public Task<Stream> DownloadAsync(string fileKey, CancellationToken ct = default)
    {
        var path = Path.Combine(_opts.BasePath, fileKey);

        if (!File.Exists(path))
            throw new FileNotFoundException($"File not found in local storage: {fileKey}");

        Stream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string fileKey, CancellationToken ct = default)
    {
        var path = Path.Combine(_opts.BasePath, fileKey);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    public string GetPublicUrl(string fileKey) => $"{_opts.BaseUrl}/{fileKey}";
}

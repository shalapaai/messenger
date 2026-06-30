namespace Messenger.Modules.Files;

using Messenger.Modules.Files.Application.Abstractions;
using Messenger.Modules.Files.Application.Contracts;
using Messenger.Modules.Files.Domain;
using Messenger.Shared.Kernel.Results;

internal sealed class FilesModuleApi(
    IFileStorage    fileStorage,
    IFileRepository fileRepository,
    Application.IUnitOfWork unitOfWork)
    : IFilesModule
{
    private const long MaxSizeBytes = 20 * 1024 * 1024; // 20 MB

    public async Task<Result<string>> UploadChatAttachmentAsync(
        Stream content, string fileName, string contentType,
        long fileSizeBytes, Guid uploadedBy, Guid chatId, CancellationToken ct = default)
    {
        if (fileSizeBytes > MaxSizeBytes)
            return Result.Failure<string>(
                Error.Validation("FileSize", "Attachment cannot exceed 20 MB"));

        var uploadResult = await fileStorage.UploadAsync(content, fileName, contentType, ct);

        var record = FileUpload.Create(
            uploadedBy, uploadResult.FileKey, fileName,
            contentType, uploadResult.SizeBytes, FileCategory.ChatAttachment, chatId);

        fileRepository.Add(record);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(uploadResult.PublicUrl);
    }
}

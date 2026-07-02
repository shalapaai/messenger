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

    private static readonly HashSet<string> AllowedAvatarMimeTypes =
        ["image/jpeg", "image/png", "image/webp", "image/gif"];

    private const long MaxAvatarSizeBytes = 5 * 1024 * 1024; // 5 MB

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

    public async Task<Result<string>> UploadGroupAvatarAsync(
        Stream content, string fileName, string contentType,
        long fileSizeBytes, Guid uploadedBy, Guid chatId, CancellationToken ct = default)
    {
        if (!AllowedAvatarMimeTypes.Contains(contentType))
            return Result.Failure<string>(
                Error.Validation("ContentType", "Avatar must be JPEG, PNG, WebP or GIF"));

        if (fileSizeBytes > MaxAvatarSizeBytes)
            return Result.Failure<string>(
                Error.Validation("FileSize", "Avatar cannot exceed 5 MB"));

        // Сначала грузим новый файл и только при успехе удаляем старый — если бы порядок был
        // обратным, а загрузка нового упала (сеть/лимит хранилища), группа осталась бы без
        // аватарки: старый файл уже стёрт, а новый так и не появился
        var existing = await fileRepository.GetGroupAvatarByChatIdAsync(chatId, ct);

        var uploadResult = await fileStorage.UploadAsync(content, fileName, contentType, ct);

        if (existing is not null)
        {
            await fileStorage.DeleteAsync(existing.FileKey, ct);
            fileRepository.Remove(existing);
        }

        var record = FileUpload.Create(
            uploadedBy, uploadResult.FileKey, fileName,
            contentType, uploadResult.SizeBytes, FileCategory.GroupAvatar, chatId);

        fileRepository.Add(record);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(uploadResult.PublicUrl);
    }
}

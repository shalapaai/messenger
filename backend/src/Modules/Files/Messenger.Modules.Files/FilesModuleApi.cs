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
    private const long MaxAttachmentSizeBytes = 25 * 1024 * 1024; // 25 MB

    // Изображения, документы, архивы, аудио/видео — обычный набор для мессенджера.
    // Исполняемые/скриптовые типы (exe, sh, bat, js и т.п.) намеренно не в списке.
    private static readonly HashSet<string> AllowedAttachmentMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        // изображения
        "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
        // документы
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain", "text/csv",
        // архивы
        "application/zip", "application/x-zip-compressed",
        "application/x-rar-compressed", "application/vnd.rar",
        "application/x-7z-compressed",
        // аудио
        "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/mp4",
        // видео
        "video/mp4", "video/webm", "video/quicktime",
    };

    private static readonly HashSet<string> AllowedAvatarMimeTypes =
        ["image/jpeg", "image/png", "image/webp", "image/gif"];

    private const long MaxAvatarSizeBytes = 5 * 1024 * 1024; // 5 MB

    public async Task<Result<string>> UploadChatAttachmentAsync(
        Stream content, string fileName, string contentType,
        long fileSizeBytes, Guid uploadedBy, Guid chatId, CancellationToken ct = default)
    {
        if (!AllowedAttachmentMimeTypes.Contains(contentType))
            return Result.Failure<string>(
                Error.Validation("ContentType", "This file type is not supported"));

        if (fileSizeBytes > MaxAttachmentSizeBytes)
            return Result.Failure<string>(
                Error.Validation("FileSize", "Attachment cannot exceed 25 MB"));

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

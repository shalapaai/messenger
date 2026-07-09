namespace Messenger.Modules.Files;

using Messenger.Modules.Files.Application;
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

    private static readonly HashSet<string> AllowedAttachmentMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif",
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

    public async Task<Result<UploadedAttachmentInfo>> UploadChatAttachmentAsync(
        Stream content, string fileName, string contentType,
        long fileSizeBytes, Guid uploadedBy, Guid chatId, CancellationToken ct = default)
    {
        if (!AllowedAttachmentMimeTypes.Contains(contentType))
            return Result.Failure<UploadedAttachmentInfo>(
                Error.Validation("ContentType", "This file type is not supported"));

        if (fileSizeBytes > MaxAttachmentSizeBytes)
            return Result.Failure<UploadedAttachmentInfo>(
                Error.Validation("FileSize", "Attachment cannot exceed 25 MB"));

        if (!FileSignatureValidator.IsPlausible(content, contentType))
            return Result.Failure<UploadedAttachmentInfo>(
                Error.Validation("ContentType", "File content does not match declared type"));

        var uploadResult = await fileStorage.UploadAsync(content, fileName, contentType, ct);

        var record = FileUpload.Create(
            uploadedBy, uploadResult.FileKey, fileName,
            contentType, uploadResult.SizeBytes, FileCategory.ChatAttachment, chatId);

        fileRepository.Add(record);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(new UploadedAttachmentInfo(uploadResult.FileKey, uploadResult.PublicUrl));
    }

    public async Task DeleteChatAttachmentAsync(string fileKey, CancellationToken ct = default)
    {
        var record = await fileRepository.GetByKeyAsync(fileKey, ct);
        if (record is null) return;

        fileRepository.Remove(record);
        await unitOfWork.SaveChangesAsync(ct);
        await fileStorage.DeleteAsync(fileKey, ct);
    }

    public async Task<Result<string>> UploadGroupAvatarAsync(
        Stream content, string fileName, string contentType,
        long fileSizeBytes, Guid uploadedBy, Guid chatId, CancellationToken ct = default)
    {
        if (!AvatarReplace.AllowedMimeTypes.Contains(contentType))
            return Result.Failure<string>(
                Error.Validation("ContentType", "Avatar must be JPEG, PNG, WebP or GIF"));

        if (fileSizeBytes > AvatarReplace.MaxSizeBytes)
            return Result.Failure<string>(
                Error.Validation("FileSize", "Avatar cannot exceed 5 MB"));

        if (!FileSignatureValidator.IsPlausible(content, contentType))
            return Result.Failure<string>(
                Error.Validation("ContentType", "File content does not match declared type"));

        var existing = await fileRepository.GetGroupAvatarByChatIdAsync(chatId, ct);

        var uploadResult = await fileStorage.UploadAsync(content, fileName, contentType, ct);

        var record = FileUpload.Create(
            uploadedBy, uploadResult.FileKey, fileName,
            contentType, uploadResult.SizeBytes, FileCategory.GroupAvatar, chatId);

        return await AvatarReplace.CommitAsync(
            fileStorage, fileRepository, unitOfWork,
            existing, record, uploadResult.FileKey, uploadResult.PublicUrl, "GroupAvatar", ct);
    }

    public async Task DeleteGroupAvatarAsync(Guid chatId, CancellationToken ct = default)
    {
        var existing = await fileRepository.GetGroupAvatarByChatIdAsync(chatId, ct);
        if (existing is null) return;

        fileRepository.Remove(existing);
        await unitOfWork.SaveChangesAsync(ct);
        await fileStorage.DeleteAsync(existing.FileKey, ct);
    }
}

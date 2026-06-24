namespace Messenger.Modules.Files.Application.Features.UploadAvatar;

using Messenger.Modules.Files.Application.Abstractions;
using Messenger.Modules.Files.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class UploadAvatarCommandHandler(
    IFileStorage fileStorage,
    IFileRepository fileRepository,
    IUnitOfWork unitOfWork)
    : ICommandHandler<UploadAvatarCommand, string>
{
    private static readonly HashSet<string> AllowedMimeTypes =
        ["image/jpeg", "image/png", "image/webp", "image/gif"];

    private const long MaxSizeBytes = 5 * 1024 * 1024; // 5 MB

    public async Task<Result<string>> Handle(UploadAvatarCommand command, CancellationToken ct)
    {
        if (!AllowedMimeTypes.Contains(command.ContentType))
            return Result.Failure<string>(
                Error.Validation("ContentType", "Avatar must be JPEG, PNG, WebP or GIF"));

        if (command.FileSizeBytes > MaxSizeBytes)
            return Result.Failure<string>(
                Error.Validation("FileSize", "Avatar cannot exceed 5 MB"));

        // Удалить предыдущий аватар, если есть
        var existing = await fileRepository.GetAvatarByUserIdAsync(command.UserId, ct);
        if (existing is not null)
        {
            await fileStorage.DeleteAsync(existing.FileKey, ct);
            fileRepository.Remove(existing);
        }

        var uploadResult = await fileStorage.UploadAsync(
            command.FileContent, command.FileName, command.ContentType, ct);

        var record = FileUpload.Create(
            command.UserId, uploadResult.FileKey, command.FileName,
            command.ContentType, uploadResult.SizeBytes, FileCategory.Avatar);

        fileRepository.Add(record);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(uploadResult.PublicUrl);
    }
}

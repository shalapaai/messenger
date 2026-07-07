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
    public async Task<Result<string>> Handle(UploadAvatarCommand command, CancellationToken ct)
    {
        if (!AvatarReplace.AllowedMimeTypes.Contains(command.ContentType))
            return Result.Failure<string>(
                Error.Validation("ContentType", "Avatar must be JPEG, PNG, WebP or GIF"));

        if (command.FileSizeBytes > AvatarReplace.MaxSizeBytes)
            return Result.Failure<string>(
                Error.Validation("FileSize", "Avatar cannot exceed 5 MB"));

        if (!FileSignatureValidator.IsPlausible(command.FileContent, command.ContentType))
            return Result.Failure<string>(
                Error.Validation("ContentType", "File content does not match declared type"));

        // Сначала грузим новый файл и только при успехе удаляем старый — иначе неудачная загрузка
        // оставила бы пользователя без аватарки вовсе.
        var existing = await fileRepository.GetAvatarByUserIdAsync(command.UserId, ct);

        var uploadResult = await fileStorage.UploadAsync(
            command.FileContent, command.FileName, command.ContentType, ct);

        var record = FileUpload.Create(
            command.UserId, uploadResult.FileKey, command.FileName,
            command.ContentType, uploadResult.SizeBytes, FileCategory.Avatar);

        return await AvatarReplace.CommitAsync(
            fileStorage, fileRepository, unitOfWork,
            existing, record, uploadResult.FileKey, uploadResult.PublicUrl, "Avatar", ct);
    }
}

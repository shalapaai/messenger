namespace Messenger.Modules.Files.Application.Features.UploadAvatar;

using Messenger.Modules.Files.Application.Abstractions;
using Messenger.Modules.Files.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

public sealed class UploadAvatarCommandHandler(
    IFileStorage fileStorage,
    IFileRepository fileRepository,
    IUnitOfWork unitOfWork)
    : ICommandHandler<UploadAvatarCommand, string>
{
    private static readonly HashSet<string> AllowedMimeTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "image/webp", "image/gif" };

    private const long MaxSizeBytes = 5 * 1024 * 1024; // 5 MB

    public async Task<Result<string>> Handle(UploadAvatarCommand command, CancellationToken ct)
    {
        if (!AllowedMimeTypes.Contains(command.ContentType))
            return Result.Failure<string>(
                Error.Validation("ContentType", "Avatar must be JPEG, PNG, WebP or GIF"));

        if (command.FileSizeBytes > MaxSizeBytes)
            return Result.Failure<string>(
                Error.Validation("FileSize", "Avatar cannot exceed 5 MB"));

        if (!FileSignatureValidator.IsPlausible(command.FileContent, command.ContentType))
            return Result.Failure<string>(
                Error.Validation("ContentType", "File content does not match declared type"));

        // Сначала грузим новый файл и только при успехе удаляем старый — если бы порядок был
        // обратным, а загрузка нового упала (сеть/лимит хранилища), пользователь остался бы
        // без аватарки: старый файл уже стёрт, а новый так и не появился
        var existing = await fileRepository.GetAvatarByUserIdAsync(command.UserId, ct);

        var uploadResult = await fileStorage.UploadAsync(
            command.FileContent, command.FileName, command.ContentType, ct);

        var record = FileUpload.Create(
            command.UserId, uploadResult.FileKey, command.FileName,
            command.ContentType, uploadResult.SizeBytes, FileCategory.Avatar);

        fileRepository.Add(record);

        try
        {
            if (existing is not null)
            {
                fileRepository.Remove(existing);
                await unitOfWork.SaveChangesAsync(ct);
                await fileStorage.DeleteAsync(existing.FileKey, ct);
            }
            else
            {
                await unitOfWork.SaveChangesAsync(ct);
            }
        }
        catch (DbUpdateException)
        {
            // TOCTOU: два одновременных аплоада аватара от одного пользователя оба прочитали
            // одно и то же "existing" и оба пытаются стать единственной текущей аватаркой —
            // второй падает на уникальном индексе (ux_file_upload_avatar_per_user) или на
            // конфликте удаления уже удалённой "existing". Подчищаем только что загруженный
            // (но не закоммиченный) файл, чтобы он не остался в хранилище без ссылки в БД.
            await fileStorage.DeleteAsync(uploadResult.FileKey, ct);
            return Result.Failure<string>(Error.Conflict("Avatar"));
        }

        return Result.Success(uploadResult.PublicUrl);
    }
}

namespace Messenger.Modules.Files.Application;

using Messenger.Modules.Files.Application.Abstractions;
using Messenger.Modules.Files.Domain;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

// Общая логика замены текущей аватарки (личной или группы): загрузка нового файла уже
// сделана вызывающим кодом, здесь — персист новой записи, удаление старой после коммита
// и обработка гонки. UploadAvatarCommandHandler и FilesModuleApi.UploadGroupAvatarAsync
// делали это почти идентично, отличаясь только тем, что и для кого ищут/удаляют.
internal static class AvatarReplace
{
    public static readonly HashSet<string> AllowedMimeTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "image/webp", "image/gif" };

    public const long MaxSizeBytes = 5 * 1024 * 1024; // 5 MB

    public static async Task<Result<string>> CommitAsync(
        IFileStorage fileStorage, IFileRepository fileRepository, IUnitOfWork unitOfWork,
        FileUpload? existing, FileUpload newRecord, string newFileKey, string publicUrl,
        string conflictEntity, CancellationToken ct)
    {
        fileRepository.Add(newRecord);

        try
        {
            if (existing is not null)
            {
                // Физическое удаление старого файла — только после коммита в БД, иначе
                // упавший SaveChangesAsync оставил бы в БД ссылку на уже стёртый файл.
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
            // TOCTOU: два одновременных аплоада на одну и ту же "текущую" аватарку — второй
            // падает на уникальном индексе (ux_file_upload_avatar_per_user /
            // ux_file_upload_group_avatar_per_chat) или на конфликте удаления уже удалённой
            // "existing". Подчищаем только что загруженный (но не закоммиченный) файл.
            await fileStorage.DeleteAsync(newFileKey, ct);
            return Result.Failure<string>(Error.Conflict(conflictEntity));
        }

        return Result.Success(publicUrl);
    }
}

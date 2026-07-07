namespace Messenger.Modules.Files.Application;

using Messenger.Modules.Files.Application.Abstractions;
using Messenger.Modules.Files.Domain;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

// Общая логика замены текущей аватарки (личной или группы): персист новой записи, удаление
// старой после коммита и обработка гонки — вынесено из UploadAvatarCommandHandler и UploadGroupAvatarAsync.
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
            // TOCTOU: параллельный аплоад той же аватарки падает на уникальном индексе —
            // подчищаем только что загруженный (но не закоммиченный) файл.
            await fileStorage.DeleteAsync(newFileKey, ct);
            return Result.Failure<string>(Error.Conflict(conflictEntity));
        }

        return Result.Success(publicUrl);
    }
}

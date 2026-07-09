namespace Messenger.Modules.Files.Application;

using Messenger.Modules.Files.Application.Abstractions;
using Messenger.Modules.Files.Domain;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

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
            await fileStorage.DeleteAsync(newFileKey, ct);
            return Result.Failure<string>(Error.Conflict(conflictEntity));
        }

        return Result.Success(publicUrl);
    }
}

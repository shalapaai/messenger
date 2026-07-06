namespace Messenger.Modules.Files.Application.Features.DeleteAvatar;

using Messenger.Modules.Files.Application.Abstractions;
using Messenger.Modules.Files.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class DeleteAvatarCommandHandler(
    IFileStorage    fileStorage,
    IFileRepository fileRepository,
    IUnitOfWork     unitOfWork)
    : ICommandHandler<DeleteAvatarCommand>
{
    public async Task<Result> Handle(DeleteAvatarCommand command, CancellationToken ct)
    {
        var existing = await fileRepository.GetAvatarByUserIdAsync(command.UserId, ct);
        if (existing is null)
            return Result.Success();

        // Сначала коммитим удаление записи в БД и только потом удаляем физический файл —
        // если бы порядок был обратным, а SaveChangesAsync упал, в БД осталась бы ссылка
        // на уже несуществующий файл (битый аватар)
        fileRepository.Remove(existing);
        await unitOfWork.SaveChangesAsync(ct);
        await fileStorage.DeleteAsync(existing.FileKey, ct);

        return Result.Success();
    }
}

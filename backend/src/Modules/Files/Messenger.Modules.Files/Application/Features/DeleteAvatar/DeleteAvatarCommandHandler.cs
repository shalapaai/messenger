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

        // Сначала коммитим удаление записи и только потом физический файл — иначе упавший
        // SaveChangesAsync оставил бы в БД ссылку на уже стёртый файл.
        fileRepository.Remove(existing);
        await unitOfWork.SaveChangesAsync(ct);
        await fileStorage.DeleteAsync(existing.FileKey, ct);

        return Result.Success();
    }
}

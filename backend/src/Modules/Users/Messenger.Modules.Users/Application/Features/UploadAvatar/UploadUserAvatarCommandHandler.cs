namespace Messenger.Modules.Users.Application.Features.UploadAvatar;

using MediatR;
using Messenger.Modules.Files.Application.Features.UploadAvatar;
using Messenger.Modules.Users.Application.Abstractions;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class UploadUserAvatarCommandHandler(
    ISender sender,
    IUserProfileRepository repository,
    IUnitOfWork unitOfWork)
    : ICommandHandler<UploadUserAvatarCommand, string>
{
    public async Task<Result<string>> Handle(UploadUserAvatarCommand command, CancellationToken ct)
    {
        var profile = await repository.GetByAuthUserIdAsync(command.AuthUserId, ct);
        if (profile is null)
            return Result.Failure<string>(Error.NotFound("UserProfile"));

        // Делегируем загрузку/удаление старого файла в Files модуль
        var uploadResult = await sender.Send(
            new UploadAvatarCommand(
                command.AuthUserId,
                command.FileContent,
                command.FileName,
                command.ContentType,
                command.FileSizeBytes),
            ct);

        if (uploadResult.IsFailure)
            return Result.Failure<string>(uploadResult.Error);

        profile.SetAvatarUrl(uploadResult.Value!);
        profile.NotifyProfileUpdated();
        repository.Update(profile);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(uploadResult.Value!);
    }
}

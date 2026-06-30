namespace Messenger.Modules.Users.Application.Features.RemoveAvatar;

using MediatR;
using Messenger.Modules.Files.Application.Features.DeleteAvatar;
using Messenger.Modules.Users.Application.Abstractions;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class RemoveUserAvatarCommandHandler(
    ISender                sender,
    IUserProfileRepository repository,
    IUnitOfWork            unitOfWork)
    : ICommandHandler<RemoveUserAvatarCommand>
{
    public async Task<Result> Handle(RemoveUserAvatarCommand command, CancellationToken ct)
    {
        var profile = await repository.GetByAuthUserIdAsync(command.AuthUserId, ct);
        if (profile is null)
            return Result.Failure(Error.NotFound("UserProfile"));

        if (profile.AvatarUrl is null)
            return Result.Success();

        await sender.Send(new DeleteAvatarCommand(command.AuthUserId), ct);

        profile.ClearAvatarUrl();
        repository.Update(profile);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}

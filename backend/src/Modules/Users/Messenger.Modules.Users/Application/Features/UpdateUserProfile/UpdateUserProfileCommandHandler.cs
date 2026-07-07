namespace Messenger.Modules.Users.Application.Features.UpdateUserProfile;

using Messenger.Modules.Users.Application.Abstractions;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class UpdateUserProfileCommandHandler(
    IUserProfileRepository repository,
    IUnitOfWork unitOfWork)
    : ICommandHandler<UpdateUserProfileCommand, UpdatedProfileDto>
{
    public async Task<Result<UpdatedProfileDto>> Handle(UpdateUserProfileCommand command, CancellationToken ct)
    {
        var profile = await repository.GetByAuthUserIdAsync(command.AuthUserId, ct);
        if (profile is null)
            return Result.Failure<UpdatedProfileDto>(Error.NotFound("UserProfile"));

        if (command.Login is not null)
        {
            var normalised = command.Login.ToLowerInvariant();
            if (await repository.ExistsByLoginAsync(normalised, profile.Id, ct))
                return Result.Failure<UpdatedProfileDto>(Error.Conflict("Users.LoginAlreadyTaken"));
            profile.SetLogin(normalised);
        }

        if (command.AvatarColor is not null)
            profile.SetAvatarColor(command.AvatarColor);

        profile.Update(command.DisplayName, command.Status, command.Phone, command.City, command.Department);
        profile.NotifyProfileUpdated();
        repository.Update(profile);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(new UpdatedProfileDto(
            profile.AuthUserId, profile.Email, profile.DisplayName,
            profile.Login is not null ? $"@{profile.Login}" : null,
            profile.Status, profile.AvatarUrl,
            profile.Phone, profile.City, profile.Department,
            profile.CreatedAt, profile.UpdatedAt));
    }
}

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

        profile.Update(command.DisplayName, command.Status);
        repository.Update(profile);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(new UpdatedProfileDto(
            profile.AuthUserId, profile.Email, profile.DisplayName,
            profile.Status, profile.AvatarUrl, profile.CreatedAt, profile.UpdatedAt));
    }
}

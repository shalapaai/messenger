namespace Messenger.Modules.Users.Application.Features.CreateUserProfile;

using Messenger.Modules.Users.Application.Abstractions;
using Messenger.Modules.Users.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class CreateUserProfileCommandHandler(
    IUserProfileRepository repository,
    IUnitOfWork unitOfWork)
    : ICommandHandler<CreateUserProfileCommand, UserProfileDto>
{
    public async Task<Result<UserProfileDto>> Handle(CreateUserProfileCommand command, CancellationToken ct)
    {
        if (await repository.ExistsByAuthUserIdAsync(command.AuthUserId, ct))
            return Result.Failure<UserProfileDto>(Error.Conflict("Users.ProfileAlreadyExists"));

        if (await repository.ExistsByEmailAsync(command.Email, ct))
            return Result.Failure<UserProfileDto>(Error.Conflict("Users.EmailAlreadyTaken"));

        if (command.Login is not null &&
            await repository.ExistsByLoginAsync(command.Login.ToLowerInvariant(), ct: ct))
            return Result.Failure<UserProfileDto>(Error.Conflict("Users.LoginAlreadyTaken"));

        var profileResult = UserProfile.Create(command.AuthUserId, command.Email, command.DisplayName, command.Login);
        if (profileResult.IsFailure)
            return Result.Failure<UserProfileDto>(profileResult.Error);

        var profile = profileResult.Value!;
        repository.Add(profile);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(ToDto(profile));
    }

    private static UserProfileDto ToDto(UserProfile p) =>
        new(p.AuthUserId, p.Email, p.DisplayName,
            p.Login is not null ? $"@{p.Login}" : null,
            p.Status, p.AvatarUrl, p.CreatedAt);
}

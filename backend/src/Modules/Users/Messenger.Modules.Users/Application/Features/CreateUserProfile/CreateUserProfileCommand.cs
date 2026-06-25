namespace Messenger.Modules.Users.Application.Features.CreateUserProfile;

using Messenger.Shared.Kernel.Abstractions;

public sealed record CreateUserProfileCommand(
    Guid   AuthUserId,
    string Username,
    string DisplayName) : ICommand<UserProfileDto>;

public sealed record UserProfileDto(
    Guid      UserId,
    string    Username,
    string    DisplayName,
    string?   Status,
    string?   AvatarUrl,
    DateTime  CreatedAt);

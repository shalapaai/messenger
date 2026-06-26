namespace Messenger.Modules.Users.Application.Features.CreateUserProfile;

using Messenger.Shared.Kernel.Abstractions;

public sealed record CreateUserProfileCommand(
    Guid    AuthUserId,
    string  Email,
    string  DisplayName,
    string? Login) : ICommand<UserProfileDto>;

public sealed record UserProfileDto(
    Guid      UserId,
    string    Email,
    string    DisplayName,
    string?   Login,
    string?   Status,
    string?   AvatarUrl,
    DateTime  CreatedAt);

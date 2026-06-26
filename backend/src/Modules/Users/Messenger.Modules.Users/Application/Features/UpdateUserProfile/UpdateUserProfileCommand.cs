namespace Messenger.Modules.Users.Application.Features.UpdateUserProfile;

using Messenger.Shared.Kernel.Abstractions;

public sealed record UpdateUserProfileCommand(
    Guid    AuthUserId,
    string? DisplayName,
    string? Status,
    string? Login) : ICommand<UpdatedProfileDto>;

public sealed record UpdatedProfileDto(
    Guid      UserId,
    string    Email,
    string    DisplayName,
    string?   Login,
    string?   Status,
    string?   AvatarUrl,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

namespace Messenger.Modules.Users.Application.Features.UpdateUserProfile;

using Messenger.Shared.Kernel.Abstractions;

public sealed record UpdateUserProfileCommand(
    Guid    AuthUserId,
    string? DisplayName,
    string? Status,
    string? Login,
    string? Phone,
    string? City,
    string? Department,
    string? AvatarColor) : ICommand<UpdatedProfileDto>;

public sealed record UpdatedProfileDto(
    Guid      UserId,
    string    Email,
    string    DisplayName,
    string?   Login,
    string?   Status,
    string?   AvatarUrl,
    string?   Phone,
    string?   City,
    string?   Department,
    DateTime  RegisteredAt,
    DateTime? UpdatedAt);

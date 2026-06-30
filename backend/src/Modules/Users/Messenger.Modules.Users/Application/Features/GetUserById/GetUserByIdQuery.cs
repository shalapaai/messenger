namespace Messenger.Modules.Users.Application.Features.GetUserById;

using Messenger.Shared.Kernel.Abstractions;

public sealed record GetUserByIdQuery(Guid RequestingUserId, Guid TargetUserId) : IQuery<PublicUserDto>;

public sealed record PublicUserDto(
    Guid    UserId,
    string  DisplayName,
    string? Login,
    string? Status,
    string? AvatarUrl,
    string  AvatarColor,
    string? Phone,
    string? City,
    string? Department,
    string  Email);

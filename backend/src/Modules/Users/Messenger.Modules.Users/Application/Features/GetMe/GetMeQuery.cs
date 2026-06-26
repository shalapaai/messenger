namespace Messenger.Modules.Users.Application.Features.GetMe;

using Messenger.Shared.Kernel.Abstractions;

public sealed record GetMeQuery(Guid AuthUserId) : IQuery<MeDto>;

public sealed record MeDto(
    Guid      UserId,
    string    Email,
    string    DisplayName,
    string?   Login,
    string?   Status,
    string?   AvatarUrl,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

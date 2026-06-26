namespace Messenger.Modules.Users.Application.Features.SearchUsers;

using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Pagination;

public sealed record SearchUsersQuery(
    Guid   RequesterId,
    string Query,
    int    Page     = 1,
    int    PageSize = 20) : IQuery<PagedList<UserSearchResultDto>>;

public sealed record UserSearchResultDto(
    Guid    UserId,
    string  Email,
    string  DisplayName,
    string? Login,
    string? AvatarUrl);

namespace Messenger.Modules.Users.Application.Features.SearchUsers;

using Messenger.Modules.Users.Application.Abstractions;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Pagination;
using Messenger.Shared.Kernel.Results;

public sealed class SearchUsersQueryHandler(IUserProfileRepository repository)
    : IQueryHandler<SearchUsersQuery, PagedList<UserSearchResultDto>>
{
    private const int MaxPageSize = 50;

    public async Task<Result<PagedList<UserSearchResultDto>>> Handle(SearchUsersQuery query, CancellationToken ct)
    {
        var pageSize = Math.Min(query.PageSize, MaxPageSize);
        var paged = await repository.SearchAsync(query.Query, query.RequesterId, query.Page, pageSize, ct);

        var items = paged.Items
            .Select(p => new UserSearchResultDto(p.AuthUserId, p.Username, p.DisplayName, p.AvatarUrl))
            .ToList();

        return Result.Success(new PagedList<UserSearchResultDto>(
            items, paged.Page, paged.PageSize, paged.TotalCount));
    }
}

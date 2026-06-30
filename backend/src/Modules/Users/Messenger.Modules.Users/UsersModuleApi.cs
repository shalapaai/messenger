namespace Messenger.Modules.Users;

using Messenger.Modules.Users.Application.Contracts;
using Messenger.Modules.Users.Infrastructure;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

// Реализация публичного API модуля — вызывается другими модулями через IUsersModule
internal sealed class UsersModuleApi(UsersDbContext dbContext) : IUsersModule
{
    public async Task<Result<Dictionary<Guid, UserSummaryDto>>> GetSummariesByAuthUserIdsAsync(
        IReadOnlyList<Guid> authUserIds, CancellationToken ct = default)
    {
        if (authUserIds.Count == 0)
            return Result.Success(new Dictionary<Guid, UserSummaryDto>());

        var profiles = await dbContext.UserProfiles
            .Where(p => authUserIds.Contains(p.AuthUserId))
            .ToListAsync(ct);

        var dict = profiles.ToDictionary(
            p => p.AuthUserId,
            p => new UserSummaryDto(p.AuthUserId, p.DisplayName, p.AvatarUrl));

        return Result.Success(dict);
    }
}

namespace Messenger.Modules.Users.Infrastructure.Repositories;

using Messenger.Modules.Users.Application.Abstractions;
using Messenger.Modules.Users.Domain;
using Messenger.Shared.Kernel.Pagination;
using Microsoft.EntityFrameworkCore;

public sealed class UserProfileRepository(UsersDbContext dbContext) : IUserProfileRepository
{
    public async Task<UserProfile?> GetByAuthUserIdAsync(Guid authUserId, CancellationToken ct = default) =>
        await dbContext.UserProfiles.FirstOrDefaultAsync(p => p.AuthUserId == authUserId, ct);

    public async Task<bool> ExistsByAuthUserIdAsync(Guid authUserId, CancellationToken ct = default) =>
        await dbContext.UserProfiles.AnyAsync(p => p.AuthUserId == authUserId, ct);

    public async Task<bool> ExistsByUsernameAsync(string username, CancellationToken ct = default) =>
        await dbContext.UserProfiles.AnyAsync(p => p.Username == username.ToLowerInvariant(), ct);

    public async Task<PagedList<UserProfile>> SearchAsync(
        string query, Guid excludeUserId, int page, int pageSize, CancellationToken ct = default)
    {
        var q = query.ToLowerInvariant();
        var baseQuery = dbContext.UserProfiles
            .Where(p => p.AuthUserId != excludeUserId &&
                        (EF.Functions.ILike(p.Username, $"%{q}%") ||
                         EF.Functions.ILike(p.DisplayName, $"%{q}%")));

        var total = await baseQuery.CountAsync(ct);
        var items = await baseQuery
            .OrderBy(p => p.Username)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedList<UserProfile>(items, page, pageSize, total);
    }

    public void Add(UserProfile profile)    => dbContext.UserProfiles.Add(profile);
    public void Update(UserProfile profile) => dbContext.UserProfiles.Update(profile);
}

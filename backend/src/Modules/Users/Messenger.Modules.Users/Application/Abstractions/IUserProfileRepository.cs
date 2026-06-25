namespace Messenger.Modules.Users.Application.Abstractions;

using Messenger.Modules.Users.Domain;
using Messenger.Shared.Kernel.Pagination;

public interface IUserProfileRepository
{
    Task<UserProfile?> GetByAuthUserIdAsync(Guid authUserId, CancellationToken ct = default);
    Task<bool>         ExistsByAuthUserIdAsync(Guid authUserId, CancellationToken ct = default);
    Task<bool>         ExistsByUsernameAsync(string username, CancellationToken ct = default);
    Task<PagedList<UserProfile>> SearchAsync(
        string query, Guid excludeUserId, int page, int pageSize, CancellationToken ct = default);
    void Add(UserProfile profile);
    void Update(UserProfile profile);
}

namespace Messenger.Modules.Users.Application.Abstractions;

using Messenger.Modules.Users.Domain;
using Messenger.Shared.Kernel.Pagination;

public interface IUserProfileRepository
{
    Task<UserProfile?> GetByAuthUserIdAsync(Guid authUserId, CancellationToken ct = default);
    Task<UserProfile?> GetByLoginAsync(string login, CancellationToken ct = default);
    Task<bool>         ExistsByAuthUserIdAsync(Guid authUserId, CancellationToken ct = default);
    Task<bool>         ExistsByEmailAsync(string email, CancellationToken ct = default);
    Task<bool>         ExistsByLoginAsync(string login, Guid? excludeId = null, CancellationToken ct = default);
    Task<PagedList<UserProfile>> SearchAsync(
        string query, Guid excludeUserId, int page, int pageSize, CancellationToken ct = default);
    void Add(UserProfile profile);
    void Update(UserProfile profile);
}

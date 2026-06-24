namespace Messenger.Modules.Auth.Application.Abstractions;

using Messenger.Modules.Auth.Domain;

public interface IUserAuthRepository
{
    Task<UserAuth?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<UserAuth?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> ExistsByEmailAsync(string email, CancellationToken ct = default);
    void Add(UserAuth user);
}

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken ct = default);
    void Add(RefreshToken token);
}

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

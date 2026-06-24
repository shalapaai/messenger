namespace Messenger.Modules.Auth.Infrastructure.Repositories;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Domain;
using Microsoft.EntityFrameworkCore;

public sealed class UserAuthRepository(AuthDbContext dbContext) : IUserAuthRepository
{
    public async Task<UserAuth?> GetByEmailAsync(string email, CancellationToken ct = default) =>
        await dbContext.Users
            .FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant(), ct);

    public async Task<UserAuth?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await dbContext.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public async Task<bool> ExistsByEmailAsync(string email, CancellationToken ct = default) =>
        await dbContext.Users.AnyAsync(u => u.Email == email.ToLowerInvariant(), ct);

    public void Add(UserAuth user) => dbContext.Users.Add(user);
}

public sealed class RefreshTokenRepository(AuthDbContext dbContext) : IRefreshTokenRepository
{
    public async Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken ct = default) =>
        await dbContext.RefreshTokens.FirstOrDefaultAsync(t => t.Token == token, ct);

    public void Add(RefreshToken token) => dbContext.RefreshTokens.Add(token);
}

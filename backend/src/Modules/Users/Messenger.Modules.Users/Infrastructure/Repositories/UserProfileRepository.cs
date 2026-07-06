namespace Messenger.Modules.Users.Infrastructure.Repositories;

using Messenger.Modules.Users.Application.Abstractions;
using Messenger.Modules.Users.Domain;
using Messenger.Shared.Kernel.Pagination;
using Microsoft.EntityFrameworkCore;

public sealed class UserProfileRepository(UsersDbContext dbContext) : IUserProfileRepository
{
    public async Task<UserProfile?> GetByAuthUserIdAsync(Guid authUserId, CancellationToken ct = default) =>
        await dbContext.UserProfiles.FirstOrDefaultAsync(p => p.AuthUserId == authUserId, ct);

    public async Task<UserProfile?> GetByLoginAsync(string login, CancellationToken ct = default) =>
        await dbContext.UserProfiles.FirstOrDefaultAsync(p => p.Login == login.ToLowerInvariant(), ct);

    public async Task<bool> ExistsByAuthUserIdAsync(Guid authUserId, CancellationToken ct = default) =>
        await dbContext.UserProfiles.AnyAsync(p => p.AuthUserId == authUserId, ct);

    public async Task<bool> ExistsByEmailAsync(string email, CancellationToken ct = default) =>
        await dbContext.UserProfiles.AnyAsync(p => p.Email == email.ToLowerInvariant(), ct);

    public async Task<bool> ExistsByLoginAsync(string login, Guid? excludeId = null, CancellationToken ct = default) =>
        await dbContext.UserProfiles.AnyAsync(
            p => p.Login == login.ToLowerInvariant() && (excludeId == null || p.Id != excludeId.Value), ct);

    public async Task<PagedList<UserProfile>> SearchAsync(
        string query, Guid excludeUserId, int page, int pageSize, CancellationToken ct = default)
    {
        var isLoginSearch = query.StartsWith('@');
        var q = query.ToLowerInvariant().TrimStart('@');

        IQueryable<UserProfile> baseQuery;
        if (isLoginSearch)
        {
            baseQuery = dbContext.UserProfiles
                .Where(p => p.AuthUserId != excludeUserId &&
                            p.Login != null && EF.Functions.ILike(p.Login, $"%{q}%"));
        }
        else
        {
            // Если сам запрос уже содержит "@" (пользователь ввёл полный или частичный
            // email вида "name@domain") — сравниваем как обычную подстроку по всему email,
            // здесь ограничивать поиск локальной частью бессмысленно и даже вредно: паттерн
            // "%q%@%" требовал бы ВТОРОГО "@" после найденного текста, которого в адресе
            // с одним "@" просто не бывает — full email вообще переставал находиться.
            // Если "@" в запросе нет — матчим только внутри локальной части (vlad@gmail.com →
            // "vlad"), иначе даже одна буква совпадала бы почти со всеми у одного провайдера
            // (gmail.com/mail.ru и т.п.), никак не отражая намерение найти конкретного человека.
            var emailPattern = q.Contains('@') ? $"%{q}%" : $"%{q}%@%";
            baseQuery = dbContext.UserProfiles
                .Where(p => p.AuthUserId != excludeUserId &&
                            (EF.Functions.ILike(p.Email, emailPattern) ||
                             EF.Functions.ILike(p.DisplayName, $"%{q}%") ||
                             (p.Login != null && EF.Functions.ILike(p.Login, $"%{q}%"))));
        }

        var total = await baseQuery.CountAsync(ct);
        var items = await baseQuery
            .OrderBy(p => p.Email)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedList<UserProfile>(items, page, pageSize, total);
    }

    public void Add(UserProfile profile)    => dbContext.UserProfiles.Add(profile);
    public void Update(UserProfile profile) => dbContext.UserProfiles.Update(profile);
}

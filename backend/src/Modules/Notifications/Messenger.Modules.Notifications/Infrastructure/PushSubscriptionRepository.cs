namespace Messenger.Modules.Notifications.Infrastructure;

using Messenger.Modules.Notifications.Domain;
using Microsoft.EntityFrameworkCore;

public interface IPushSubscriptionRepository
{
    Task UpsertAsync(Guid userId, string endpoint, string p256dh, string auth, string? userAgent, CancellationToken ct = default);
    Task DeleteAsync(Guid userId, string endpoint, CancellationToken ct = default);
    Task<List<PushSubscription>> GetByUserIdsAsync(IReadOnlyList<Guid> userIds, CancellationToken ct = default);
    Task DeleteByEndpointAsync(string endpoint, CancellationToken ct = default);
}

internal sealed class PushSubscriptionRepository(NotificationsDbContext db) : IPushSubscriptionRepository
{
    public async Task UpsertAsync(Guid userId, string endpoint, string p256dh, string auth, string? userAgent, CancellationToken ct = default)
    {
        var existing = await db.PushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == endpoint, ct);

        if (existing is null)
        {
            db.PushSubscriptions.Add(PushSubscription.Create(userId, endpoint, p256dh, auth, userAgent));
        }
        else
        {
            existing.Update(userId, p256dh, auth, userAgent);
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid userId, string endpoint, CancellationToken ct = default)
    {
        await db.PushSubscriptions
            .Where(s => s.UserId == userId && s.Endpoint == endpoint)
            .ExecuteDeleteAsync(ct);
    }

    public Task<List<PushSubscription>> GetByUserIdsAsync(IReadOnlyList<Guid> userIds, CancellationToken ct = default) =>
        db.PushSubscriptions
            .Where(s => userIds.Contains(s.UserId))
            .ToListAsync(ct);

    public async Task DeleteByEndpointAsync(string endpoint, CancellationToken ct = default)
    {
        await db.PushSubscriptions
            .Where(s => s.Endpoint == endpoint)
            .ExecuteDeleteAsync(ct);
    }
}

namespace Messenger.Modules.Notifications.Domain;

public sealed class PushSubscription
{
    private PushSubscription() { }

    private PushSubscription(Guid id, Guid userId, string endpoint, string p256dh, string auth, string? userAgent)
    {
        Id = id;
        UserId = userId;
        Endpoint = endpoint;
        P256dh = p256dh;
        Auth = auth;
        UserAgent = userAgent;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string Endpoint { get; private set; } = string.Empty;
    public string P256dh { get; private set; } = string.Empty;
    public string Auth { get; private set; } = string.Empty;
    public string? UserAgent { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public static PushSubscription Create(Guid userId, string endpoint, string p256dh, string auth, string? userAgent) =>
        new(Guid.NewGuid(), userId, endpoint, p256dh, auth, userAgent);

    public void Update(Guid userId, string p256dh, string auth, string? userAgent)
    {
        UserId = userId;
        P256dh = p256dh;
        Auth = auth;
        UserAgent = userAgent;
        UpdatedAt = DateTime.UtcNow;
    }
}

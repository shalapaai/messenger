namespace Messenger.Modules.Auth.Domain;

using Messenger.Shared.Kernel.Primitives;

public sealed class RefreshToken : Entity<Guid>
{
    private RefreshToken() { } // EF Core

    private RefreshToken(Guid id, Guid userId, string token, DateTime expiresAt) : base(id)
    {
        UserId = userId;
        Token = token;
        ExpiresAt = expiresAt;
        CreatedAt = DateTime.UtcNow;
        IsRevoked = false;
    }

    public Guid UserId { get; private set; }
    public string Token { get; private set; } = string.Empty;
    public DateTime ExpiresAt { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public bool IsRevoked { get; private set; }
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsActive => !IsRevoked && !IsExpired;

    public static RefreshToken Create(Guid userId, string token, int expirationDays) =>
        new(Guid.NewGuid(), userId, token, DateTime.UtcNow.AddDays(expirationDays));

    public void Revoke() => IsRevoked = true;
}

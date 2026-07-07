namespace Messenger.Modules.Auth.Domain;

using System.Security.Cryptography;
using System.Text;
using Messenger.Shared.Kernel.Primitives;

public sealed class RefreshToken : Entity<Guid>
{
    private RefreshToken() { } // EF Core

    private RefreshToken(Guid id, Guid userId, string tokenHash, DateTime expiresAt) : base(id)
    {
        UserId = userId;
        Token = tokenHash;
        ExpiresAt = expiresAt;
        CreatedAt = DateTime.UtcNow;
        IsRevoked = false;
    }

    public Guid UserId { get; private set; }
    /// <summary>SHA-256 хэш токена, а не сам токен — при утечке БД хранящиеся здесь значения
    /// нельзя использовать напрямую как рабочий refresh-токен.</summary>
    public string Token { get; private set; } = string.Empty;
    public DateTime ExpiresAt { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public bool IsRevoked { get; private set; }
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsActive => !IsRevoked && !IsExpired;

    public static RefreshToken Create(Guid userId, string plainTextToken, int expirationDays) =>
        new(Guid.NewGuid(), userId, Hash(plainTextToken), DateTime.UtcNow.AddDays(expirationDays));

    public void Revoke() => IsRevoked = true;

    /// <summary>Токен — 64 случайных байта (см. JwtTokenService.GenerateRefreshToken), уже
    /// достаточно высокоэнтропийный, поэтому быстрый SHA-256 достаточен: в отличие от паролей
    /// здесь не нужен медленный KDF (bcrypt/argon2) для защиты от подбора.</summary>
    public static string Hash(string plainTextToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plainTextToken)));
}

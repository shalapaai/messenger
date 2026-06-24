namespace Messenger.Modules.Auth.Domain;

using Messenger.Shared.Kernel.Primitives;
using Messenger.Shared.Kernel.Results;

// Aggrgate Auth-модуля — хранит только данные аутентификации
// Профиль пользователя (имя, аватар и т.д.) — в модуле Users
public sealed class UserAuth : AggregateRoot<Guid>
{
    private UserAuth() { } // EF Core

    private UserAuth(Guid id, string email, string passwordHash) : base(id)
    {
        Email = email;
        PasswordHash = passwordHash;
        CreatedAt = DateTime.UtcNow;
        IsEmailVerified = false;
    }

    public string Email { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public bool IsEmailVerified { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public static Result<UserAuth> Create(string email, string passwordHash)
    {
        if (string.IsNullOrWhiteSpace(email))
            return Result.Failure<UserAuth>(Error.Validation("Email", "Email is required"));

        return Result.Success(new UserAuth(Guid.NewGuid(), email.ToLowerInvariant(), passwordHash));
    }

    public void VerifyEmail() => IsEmailVerified = true;
}

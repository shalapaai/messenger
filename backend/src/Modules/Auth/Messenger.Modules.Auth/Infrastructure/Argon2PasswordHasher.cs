namespace Messenger.Modules.Auth.Infrastructure;

using Messenger.Modules.Auth.Application.Abstractions;

// BCrypt как альтернатива Argon2 — production-ready, встроен в BCrypt.Net-Next
public sealed class BcryptPasswordHasher : IPasswordHasher
{
    private const int WorkFactor = 12;

    public string Hash(string password) =>
        BCrypt.Net.BCrypt.EnhancedHashPassword(password, WorkFactor);

    public bool Verify(string password, string hash) =>
        BCrypt.Net.BCrypt.EnhancedVerify(password, hash);
}

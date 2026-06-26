namespace Messenger.Modules.Users.Domain;

using Messenger.Shared.Kernel.Primitives;
using Messenger.Shared.Kernel.Results;

public sealed class UserProfile : AggregateRoot<Guid>
{
    private UserProfile() { } // EF Core

    private UserProfile(Guid id, Guid authUserId, string email, string displayName, string? login) : base(id)
    {
        AuthUserId  = authUserId;
        Email       = email.ToLowerInvariant();
        DisplayName = displayName;
        Login       = login?.ToLowerInvariant();
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid      AuthUserId  { get; private set; }
    public string    Email       { get; private set; } = string.Empty;
    public string    DisplayName { get; private set; } = string.Empty;
    public string?   Login       { get; private set; }
    public string?   Status      { get; private set; }
    public string?   AvatarUrl   { get; private set; }
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }

    public static Result<UserProfile> Create(Guid authUserId, string email, string displayName, string? login = null) =>
        Result.Success(new UserProfile(Guid.NewGuid(), authUserId, email, displayName, login));

    public void Update(string? displayName, string? status)
    {
        if (displayName is not null) DisplayName = displayName;
        if (status      is not null) Status      = status;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetLogin(string login)
    {
        Login     = login.ToLowerInvariant();
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetAvatarUrl(string avatarUrl)
    {
        AvatarUrl = avatarUrl;
        UpdatedAt = DateTime.UtcNow;
    }
}

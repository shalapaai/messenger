namespace Messenger.Modules.Users.Domain;

using Messenger.Shared.Kernel.Primitives;
using Messenger.Shared.Kernel.Results;

public sealed class UserProfile : AggregateRoot<Guid>
{
    private UserProfile() { } // EF Core

    private UserProfile(Guid id, Guid authUserId, string username, string displayName) : base(id)
    {
        AuthUserId  = authUserId;
        Username    = username;
        DisplayName = displayName;
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid     AuthUserId  { get; private set; }
    public string   Username    { get; private set; } = string.Empty;
    public string   DisplayName { get; private set; } = string.Empty;
    public string?  Status      { get; private set; }
    public string?  AvatarUrl   { get; private set; }
    public DateTime  CreatedAt  { get; private set; }
    public DateTime? UpdatedAt  { get; private set; }

    public static Result<UserProfile> Create(Guid authUserId, string username, string displayName) =>
        Result.Success(new UserProfile(Guid.NewGuid(), authUserId, username.ToLowerInvariant(), displayName));

    public void Update(string? username, string? displayName, string? status)
    {
        if (username    is not null) Username    = username.ToLowerInvariant();
        if (displayName is not null) DisplayName = displayName;
        if (status      is not null) Status      = status;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetAvatarUrl(string avatarUrl)
    {
        AvatarUrl = avatarUrl;
        UpdatedAt = DateTime.UtcNow;
    }
}

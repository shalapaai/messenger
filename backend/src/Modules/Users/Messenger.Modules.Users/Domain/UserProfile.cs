namespace Messenger.Modules.Users.Domain;

using Messenger.Shared.Kernel.Primitives;
using Messenger.Shared.Kernel.Results;

public sealed class UserProfile : AggregateRoot<Guid>
{
    private static readonly string[] Palette =
    [
        "#2C5BF0", "#7A5BF0", "#22B07D", "#F0902C", "#E0556E", "#2CA6C9", "#9B59B6"
    ];

    private UserProfile() { } // EF Core

    private UserProfile(Guid id, Guid authUserId, string email, string displayName, string? login) : base(id)
    {
        AuthUserId  = authUserId;
        Email       = email.ToLowerInvariant();
        DisplayName = displayName;
        Login       = login?.ToLowerInvariant();
        AvatarColor = Palette[Random.Shared.Next(Palette.Length)];
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid      AuthUserId  { get; private set; }
    public string    Email       { get; private set; } = string.Empty;
    public string    DisplayName { get; private set; } = string.Empty;
    public string?   Login       { get; private set; }
    public string?   Status      { get; private set; }
    public string?   AvatarUrl   { get; private set; }
    public string    AvatarColor { get; private set; } = "#2C5BF0";
    public string?   Phone       { get; private set; }
    public string?   City        { get; private set; }
    public string?   Department  { get; private set; }
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }

    public static Result<UserProfile> Create(Guid authUserId, string email, string displayName, string? login = null) =>
        Result.Success(new UserProfile(Guid.NewGuid(), authUserId, email, displayName, login));

    public void Update(string? displayName, string? status, string? phone, string? city, string? department)
    {
        if (displayName is not null) DisplayName = displayName;
        if (status      is not null) Status      = status.Length > 0 ? status     : null;
        if (phone       is not null) Phone       = phone.Length  > 0 ? phone      : null;
        if (city        is not null) City        = city.Length   > 0 ? city       : null;
        if (department  is not null) Department  = department.Length > 0 ? department : null;
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

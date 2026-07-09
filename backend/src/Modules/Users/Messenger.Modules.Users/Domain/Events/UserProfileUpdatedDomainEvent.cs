namespace Messenger.Modules.Users.Domain.Events;

using Messenger.Shared.Kernel.Primitives;

public sealed record UserProfileUpdatedDomainEvent(
    Guid Id,
    DateTime OccurredOn,
    Guid AuthUserId,
    string DisplayName,
    string? AvatarUrl,
    string AvatarColor) : IDomainEvent
{
    public UserProfileUpdatedDomainEvent(Guid authUserId, string displayName, string? avatarUrl, string avatarColor)
        : this(Guid.NewGuid(), DateTime.UtcNow, authUserId, displayName, avatarUrl, avatarColor) { }
}

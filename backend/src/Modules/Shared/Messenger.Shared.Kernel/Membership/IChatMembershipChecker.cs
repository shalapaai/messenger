namespace Messenger.Shared.Kernel.Membership;

public interface IChatMembershipChecker
{
    Task<bool> IsMemberAsync(Guid chatId, Guid userId, CancellationToken ct = default);
    Task<bool> CanModerateAsync(Guid chatId, Guid userId, CancellationToken ct = default);
    Task<bool> IsGroupChatAsync(Guid chatId, CancellationToken ct = default);
}

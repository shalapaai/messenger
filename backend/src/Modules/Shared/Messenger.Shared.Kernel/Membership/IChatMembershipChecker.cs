namespace Messenger.Shared.Kernel.Membership;

public interface IChatMembershipChecker
{
    Task<bool> IsMemberAsync(Guid chatId, Guid userId, CancellationToken ct = default);
}

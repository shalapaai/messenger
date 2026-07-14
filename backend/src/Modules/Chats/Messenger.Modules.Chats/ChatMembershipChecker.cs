namespace Messenger.Modules.Chats;

using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Membership;

internal sealed class ChatMembershipChecker(IChatRepository chatRepository) : IChatMembershipChecker
{
    public Task<bool> IsMemberAsync(Guid chatId, Guid userId, CancellationToken ct = default) =>
        chatRepository.IsMemberAsync(ChatId.From(chatId), userId, ct);

    public Task<bool> CanModerateAsync(Guid chatId, Guid userId, CancellationToken ct = default) =>
        chatRepository.IsModeratorAsync(ChatId.From(chatId), userId, ct);

    public async Task<bool> IsGroupChatAsync(Guid chatId, CancellationToken ct = default)
    {
        var chat = await chatRepository.GetByIdAsync(ChatId.From(chatId), ct);
        return chat is not null && chat.Type == ChatType.Group;
    }
}

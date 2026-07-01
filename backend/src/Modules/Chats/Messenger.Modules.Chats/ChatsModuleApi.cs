namespace Messenger.Modules.Chats;

using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Results;

// Реализация публичного API модуля — вызывается другими модулями через IChatsModule
internal sealed class ChatsModuleApi(IChatRepository chatRepository) : IChatsModule
{
    public async Task<Result<List<Guid>>> GetChatIdsByUserIdAsync(Guid userId, CancellationToken ct = default)
    {
        var chats = await chatRepository.GetByUserIdAsync(userId, ct);
        return Result.Success(chats.Select(c => c.Id.Value).ToList());
    }

    public async Task<Result<List<Guid>>> GetMemberIdsAsync(Guid chatId, CancellationToken ct = default)
    {
        var chat = await chatRepository.GetByIdAsync(ChatId.From(chatId), ct);
        if (chat is null) return Result.Failure<List<Guid>>(Error.NotFound("Chat"));
        return Result.Success(chat.Members.Select(m => m.UserId).ToList());
    }
}

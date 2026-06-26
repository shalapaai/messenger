namespace Messenger.Modules.Chats.Application.Features.GetChats;

using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class GetChatsQueryHandler(
    IChatRepository  chatRepository,
    IMessagesModule  messagesModule)
    : IQueryHandler<GetChatsQuery, List<ChatSummaryDto>>
{
    public async Task<Result<List<ChatSummaryDto>>> Handle(GetChatsQuery query, CancellationToken ct)
    {
        var chats = await chatRepository.GetByUserIdAsync(query.CurrentUserId, ct);

        var chatIds = chats.Select(c => c.Id.Value).ToList();

        var lastMessagesResult = await messagesModule.GetLastMessagesByChatIdsAsync(chatIds, ct);
        if (lastMessagesResult.IsFailure)
            return Result.Failure<List<ChatSummaryDto>>(lastMessagesResult.Error);

        var lastMessages = lastMessagesResult.Value!;

        var result = chats
            .Select(c =>
            {
                lastMessages.TryGetValue(c.Id.Value, out var lastMessage);
                return new ChatSummaryDto(
                    c.Id.Value,
                    c.Type.ToString().ToLower(),
                    c.Name,
                    c.AvatarUrl,
                    lastMessage);
            })
            .OrderByDescending(c => c.LastMessage?.SentAt)
            .ToList();

        return Result.Success(result);
    }
}

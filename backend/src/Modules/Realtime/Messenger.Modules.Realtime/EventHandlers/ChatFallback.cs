namespace Messenger.Modules.Realtime.EventHandlers;

using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Realtime.Hubs;
using Microsoft.AspNetCore.SignalR;

// Общий fallback для событий по чату: рассылка в группу chat:{id} не доходит до клиента,
// который ещё не вызвал JoinChat для этого чата (например, чат только что стал видимым
// у получателя). MessageSentEventHandler уже так делал — этот helper переиспользует ту же
// логику для остальных обработчиков (MessageEdited/MessageDeleted/MessagesRead), которые
// раньше слали только в группу чата и могли не доходить до таких клиентов.
internal static class ChatFallback
{
    public static async Task BroadcastToMembersAsync(
        IHubContext<MessengerHub> hubContext,
        IChatsModule chatsModule,
        Guid chatId,
        string method,
        object payload,
        CancellationToken ct,
        Guid? excludeUserId = null)
    {
        var membersResult = await chatsModule.GetMemberIdsAsync(chatId, ct);
        if (membersResult.IsFailure) return;

        var tasks = membersResult.Value!
            .Where(uid => uid != excludeUserId)
            .Select(uid => hubContext.Clients
                .Group(MessengerHub.UserGroup(uid.ToString()))
                .SendAsync(method, payload, ct));
        await Task.WhenAll(tasks);
    }
}

namespace Messenger.Modules.Realtime.EventHandlers;

using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Shared.Kernel.Results;
using Microsoft.AspNetCore.SignalR;

// Общий fallback для событий по чату: рассылка в группу chat:{id} не доходит до клиента,
// который ещё не вызвал JoinChat для этого чата (например, чат только что стал видимым
// у получателя). Используется всеми обработчиками (ReceiveMessage/MessageEdited/
// MessageDeleted/MessagesRead), которые иначе слали бы только в группу чата и могли
// не доходить до таких клиентов.
internal static class ChatFallback
{
    public static Task BroadcastToMembersAsync(
        IHubContext<MessengerHub> hubContext,
        IChatsModule chatsModule,
        Guid chatId,
        string method,
        object payload,
        CancellationToken ct,
        Guid? excludeUserId = null) =>
        BroadcastToMembersAsync(hubContext, chatsModule.GetMemberIdsAsync(chatId, ct), method, payload, ct, excludeUserId);

    // Перегрузка, принимающая уже запущенный (в идеале — заранее стартовавший) поиск
    // участников — для вызывающих вроде MessageSentEventHandler, которым есть чем занять
    // время до рассылки (резолв превью цитаты / summary отправителя), и которые поэтому
    // стартуют membersTask заранее вместо ожидания перед самой рассылкой.
    public static async Task BroadcastToMembersAsync(
        IHubContext<MessengerHub> hubContext,
        Task<Result<List<Guid>>> membersTask,
        string method,
        object payload,
        CancellationToken ct,
        Guid? excludeUserId = null)
    {
        var membersResult = await membersTask;
        if (membersResult.IsFailure) return;

        var tasks = membersResult.Value!
            .Where(uid => uid != excludeUserId)
            .Select(uid => hubContext.Clients
                .Group(MessengerHub.UserGroup(uid.ToString()))
                .SendAsync(method, payload, ct));
        await Task.WhenAll(tasks);
    }
}

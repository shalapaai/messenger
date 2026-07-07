namespace Messenger.Modules.Realtime.EventHandlers;

using Messenger.Modules.Realtime.Hubs;
using Messenger.Shared.Kernel.Results;
using Microsoft.AspNetCore.SignalR;

// Общий fallback для событий по чату: рассылка в группу chat:{id} не доходит до клиента,
// который ещё не вызвал JoinChat (например, чат только что стал видимым у получателя).
// Вызывающие сами стартуют membersTask заранее и параллелят её с групповой рассылкой.
internal static class ChatFallback
{
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

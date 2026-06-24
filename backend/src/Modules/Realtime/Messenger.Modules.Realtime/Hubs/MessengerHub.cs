namespace Messenger.Modules.Realtime.Hubs;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

[Authorize]
public sealed class MessengerHub : Hub
{
    // Клиент вызывает при открытии чата — подписывается на сообщения в группе
    public async Task JoinChat(Guid chatId) =>
        await Groups.AddToGroupAsync(Context.ConnectionId, ChatGroup(chatId));

    public async Task LeaveChat(Guid chatId) =>
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, ChatGroup(chatId));

    public override async Task OnConnectedAsync()
    {
        // Клиент подписывается на личные уведомления через группу userId
        var userId = Context.UserIdentifier!;
        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(userId));
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier!;
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, UserGroup(userId));
        await base.OnDisconnectedAsync(exception);
    }

    public static string ChatGroup(Guid chatId) => $"chat:{chatId}";
    public static string UserGroup(string userId) => $"user:{userId}";
}

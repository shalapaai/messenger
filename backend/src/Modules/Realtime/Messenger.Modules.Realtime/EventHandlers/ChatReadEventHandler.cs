namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Chats.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Microsoft.AspNetCore.SignalR;

public sealed class ChatReadEventHandler(
    IHubContext<MessengerHub> hubContext,
    IChatsModule chatsModule)
    : INotificationHandler<ChatReadDomainEvent>
{
    public async Task Handle(ChatReadDomainEvent notification, CancellationToken ct)
    {
        var payload = new
        {
            chatId   = notification.ChatId,
            readerId = notification.ReaderId,
            readAt   = notification.ReadAt,
        };

        await hubContext.Clients
            .Group(MessengerHub.ChatGroup(notification.ChatId))
            .SendAsync("MessagesRead", payload, ct);

        await ChatFallback.BroadcastToMembersAsync(hubContext, chatsModule, notification.ChatId, "MessagesRead", payload, ct);
    }
}

namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Chats.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Microsoft.AspNetCore.SignalR;

public sealed class ChatReadEventHandler(IHubContext<MessengerHub> hubContext)
    : INotificationHandler<ChatReadDomainEvent>
{
    public async Task Handle(ChatReadDomainEvent notification, CancellationToken ct)
    {
        await hubContext.Clients
            .Group(MessengerHub.ChatGroup(notification.ChatId))
            .SendAsync("MessagesRead", new
            {
                chatId   = notification.ChatId,
                readerId = notification.ReaderId,
                readAt   = notification.ReadAt,
            }, ct);
    }
}

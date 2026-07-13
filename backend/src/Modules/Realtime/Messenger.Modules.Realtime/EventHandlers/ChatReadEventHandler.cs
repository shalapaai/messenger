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

        var membersTask = chatsModule.GetMemberIdsAsync(notification.ChatId, ct);

        await ChatFallback.BroadcastToMembersAsync(hubContext, membersTask, "MessagesRead", payload, ct);
    }
}

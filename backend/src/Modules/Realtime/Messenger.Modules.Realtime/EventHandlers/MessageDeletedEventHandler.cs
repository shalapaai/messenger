namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Messages.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Microsoft.AspNetCore.SignalR;

public sealed class MessageDeletedEventHandler(IHubContext<MessengerHub> hubContext)
    : INotificationHandler<MessageDeletedDomainEvent>
{
    public async Task Handle(MessageDeletedDomainEvent notification, CancellationToken ct)
    {
        var payload = new
        {
            messageId = notification.MessageId,
            chatId    = notification.ChatId
        };

        await hubContext.Clients
            .Group(MessengerHub.ChatGroup(notification.ChatId))
            .SendAsync("MessageDeleted", payload, ct);
    }
}

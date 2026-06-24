namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Messages.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Microsoft.AspNetCore.SignalR;

public sealed class MessageEditedEventHandler(IHubContext<MessengerHub> hubContext)
    : INotificationHandler<MessageEditedDomainEvent>
{
    public async Task Handle(MessageEditedDomainEvent notification, CancellationToken ct)
    {
        var payload = new
        {
            messageId  = notification.MessageId,
            chatId     = notification.ChatId,
            newContent = notification.NewContent,
            editedAt   = notification.OccurredOn
        };

        await hubContext.Clients
            .Group(MessengerHub.ChatGroup(notification.ChatId))
            .SendAsync("MessageEdited", payload, ct);
    }
}

namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Messages.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Microsoft.AspNetCore.SignalR;

// Реагирует на доменное событие Messages-модуля и транслирует в WebSocket
// Межмодульная связь через MediatR INotification — не прямой вызов
public sealed class MessageSentEventHandler(IHubContext<MessengerHub> hubContext)
    : INotificationHandler<MessageSentDomainEvent>
{
    public async Task Handle(MessageSentDomainEvent notification, CancellationToken ct)
    {
        var payload = new
        {
            messageId = notification.MessageId,
            chatId    = notification.ChatId,
            senderId  = notification.SenderId,
            content   = notification.Content,
            sentAt    = notification.OccurredOn
        };

        await hubContext.Clients
            .Group(MessengerHub.ChatGroup(notification.ChatId))
            .SendAsync("ReceiveMessage", payload, ct);
    }
}

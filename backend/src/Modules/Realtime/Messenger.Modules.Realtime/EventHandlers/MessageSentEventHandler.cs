namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Messages.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Modules.Users.Application.Contracts;
using Microsoft.AspNetCore.SignalR;

// Реагирует на доменное событие Messages-модуля и транслирует в WebSocket
// Межмодульная связь через MediatR INotification — не прямой вызов
public sealed class MessageSentEventHandler(IHubContext<MessengerHub> hubContext, IUsersModule usersModule)
    : INotificationHandler<MessageSentDomainEvent>
{
    public async Task Handle(MessageSentDomainEvent notification, CancellationToken ct)
    {
        var summariesResult = await usersModule.GetSummariesByAuthUserIdsAsync([notification.SenderId], ct);
        UserSummaryDto? sender = null;
        if (summariesResult.IsSuccess)
            summariesResult.Value!.TryGetValue(notification.SenderId, out sender);

        var payload = new
        {
            messageId        = notification.MessageId,
            chatId           = notification.ChatId,
            senderId         = notification.SenderId,
            senderName       = sender?.DisplayName ?? "Пользователь",
            senderAvatarUrl  = sender?.AvatarUrl,
            senderAvatarColor = sender?.AvatarColor ?? "#2C5BF0",
            content          = notification.Content,
            sentAt           = notification.OccurredOn
        };

        await hubContext.Clients
            .Group(MessengerHub.ChatGroup(notification.ChatId))
            .SendAsync("ReceiveMessage", payload, ct);
    }
}

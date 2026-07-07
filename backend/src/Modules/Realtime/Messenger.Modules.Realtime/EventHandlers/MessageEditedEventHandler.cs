namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Messages.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Microsoft.AspNetCore.SignalR;

public sealed class MessageEditedEventHandler(
    IHubContext<MessengerHub> hubContext,
    IChatsModule chatsModule)
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

        // Fallback-рассылка не зависит от группового send — запускаем параллельно, а не после.
        var membersTask = chatsModule.GetMemberIdsAsync(notification.ChatId, ct);

        var groupSendTask = hubContext.Clients
            .Group(MessengerHub.ChatGroup(notification.ChatId))
            .SendAsync("MessageEdited", payload, ct);

        await Task.WhenAll(
            groupSendTask,
            ChatFallback.BroadcastToMembersAsync(hubContext, membersTask, "MessageEdited", payload, ct));
    }
}

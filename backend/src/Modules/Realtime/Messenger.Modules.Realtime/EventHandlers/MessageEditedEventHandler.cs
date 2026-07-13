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

        var membersTask = chatsModule.GetMemberIdsAsync(notification.ChatId, ct);

        await ChatFallback.BroadcastToMembersAsync(hubContext, membersTask, "MessageEdited", payload, ct);
    }
}

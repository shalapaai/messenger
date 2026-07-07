namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Messages.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Modules.Users.Application.Contracts;
using Microsoft.AspNetCore.SignalR;

public sealed class MessageReactionChangedEventHandler(
    IHubContext<MessengerHub> hubContext,
    IUsersModule usersModule)
    : INotificationHandler<MessageReactionChangedDomainEvent>
{
    public async Task Handle(MessageReactionChangedDomainEvent notification, CancellationToken ct)
    {
        UserSummaryDto? user = null;
        var summariesResult = await usersModule.GetSummariesByAuthUserIdsAsync([notification.UserId], ct);
        if (summariesResult.IsSuccess)
            summariesResult.Value!.TryGetValue(notification.UserId, out user);

        var payload = new
        {
            messageId = notification.MessageId,
            chatId = notification.ChatId,
            userId = notification.UserId,
            userName = user?.DisplayName ?? "Пользователь",
            userAvatarUrl = user?.AvatarUrl,
            userAvatarColor = user?.AvatarColor ?? "#2C5BF0",
            emoji = notification.Emoji,
        };

        await hubContext.Clients
            .Group(MessengerHub.ChatGroup(notification.ChatId))
            .SendAsync("MessageReactionChanged", payload, ct);
    }
}

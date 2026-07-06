namespace Messenger.Modules.Notifications.EventHandlers;

using MediatR;
using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Messages.Domain.Events;
using Messenger.Modules.Notifications.Application;
using Messenger.Modules.Notifications.Infrastructure;
using Messenger.Modules.Users.Application.Contracts;

public sealed class MessageSentPushNotificationHandler(
    IChatsModule chatsModule,
    IUsersModule usersModule,
    IPushSubscriptionRepository subscriptionRepository,
    IWebPushNotificationSender pushSender)
    : INotificationHandler<MessageSentDomainEvent>
{
    public async Task Handle(MessageSentDomainEvent notification, CancellationToken ct)
    {
        var membersResult = await chatsModule.GetMemberIdsAsync(notification.ChatId, ct);
        if (membersResult.IsFailure) return;

        var recipients = membersResult.Value!
            .Where(userId => userId != notification.SenderId)
            .Distinct()
            .ToList();

        if (recipients.Count == 0) return;

        var subscriptions = await subscriptionRepository.GetByUserIdsAsync(recipients, ct);
        if (subscriptions.Count == 0) return;

        var senderName = "Пользователь";
        var summariesResult = await usersModule.GetSummariesByAuthUserIdsAsync([notification.SenderId], ct);
        if (summariesResult.IsSuccess &&
            summariesResult.Value!.TryGetValue(notification.SenderId, out var sender))
        {
            senderName = sender.DisplayName;
        }

        var body = string.IsNullOrWhiteSpace(notification.Content)
            ? (notification.Attachments.Count > 0 ? "Вложение" : "Новое сообщение")
            : notification.Content;

        await pushSender.SendAsync(subscriptions, new PushNotificationPayload(
            Title: senderName,
            Body: body,
            Url: $"/chats/{notification.ChatId}",
            ChatId: notification.ChatId.ToString(),
            SenderId: notification.SenderId.ToString(),
            Tag: $"message-{notification.MessageId}"), ct);
    }
}

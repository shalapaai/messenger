namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Modules.Messages.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Modules.Users.Application.Contracts;
using Microsoft.AspNetCore.SignalR;

// Реагирует на доменное событие Messages-модуля и транслирует в WebSocket
// Межмодульная связь через MediatR INotification — не прямой вызов
public sealed class MessageSentEventHandler(
    IHubContext<MessengerHub> hubContext,
    IUsersModule usersModule,
    IChatsModule chatsModule,
    IMessagesModule messagesModule)
    : INotificationHandler<MessageSentDomainEvent>
{
    public async Task Handle(MessageSentDomainEvent notification, CancellationToken ct)
    {
        // не зависит от резолва превью/имён ниже — запускаем сразу, дожидаемся только перед использованием
        var membersTask = chatsModule.GetMemberIdsAsync(notification.ChatId, ct);

        // превью цитируемого сообщения — для карточки "в ответ на" на клиенте
        MessagePreviewDto? replyTo = null;
        if (notification.ReplyToMessageId is { } replyId)
        {
            var replyResult = await messagesModule.GetMessagePreviewsByIdsAsync([replyId], ct);
            if (replyResult.IsSuccess) replyResult.Value!.TryGetValue(replyId, out replyTo);
        }

        var userIds = new List<Guid> { notification.SenderId };
        if (notification.ForwardedFromUserId is { } fwId) userIds.Add(fwId);
        if (replyTo is { } rt) userIds.Add(rt.SenderId);

        var summariesResult = await usersModule.GetSummariesByAuthUserIdsAsync(userIds.Distinct().ToList(), ct);

        UserSummaryDto? sender = null;
        UserSummaryDto? forwardedFromUser = null;
        UserSummaryDto? replyToSender = null;
        if (summariesResult.IsSuccess)
        {
            var summaries = summariesResult.Value!;
            summaries.TryGetValue(notification.SenderId, out sender);
            if (notification.ForwardedFromUserId is { } id) summaries.TryGetValue(id, out forwardedFromUser);
            if (replyTo is { } rt2) summaries.TryGetValue(rt2.SenderId, out replyToSender);
        }

        var payload = new
        {
            messageId        = notification.MessageId,
            chatId           = notification.ChatId,
            senderId         = notification.SenderId,
            senderName       = sender?.DisplayName ?? "Пользователь",
            senderAvatarUrl  = sender?.AvatarUrl,
            senderAvatarColor = sender?.AvatarColor ?? "#2C5BF0",
            content          = notification.Content,
            sentAt           = notification.OccurredOn,
            forwardedFromUserId   = notification.ForwardedFromUserId,
            forwardedFromUserName = forwardedFromUser?.DisplayName,
            replyToMessageId   = notification.ReplyToMessageId,
            replyToSenderName  = replyToSender?.DisplayName,
            replyToContent     = replyTo is null ? null : (replyTo.IsDeleted ? null : MessagePreview.Truncate(replyTo.Content))
        };

        // Рассылаем в группу чата всем подписанным участникам
        await hubContext.Clients
            .Group(MessengerHub.ChatGroup(notification.ChatId))
            .SendAsync("ReceiveMessage", payload, ct);

        // Дополнительно рассылаем в личные группы участников-не-отправителей —
        // нужно для случая, когда чат только что создан и получатель ещё не в группе
        var membersResult = await membersTask;
        if (membersResult.IsSuccess)
        {
            var tasks = membersResult.Value!
                .Where(uid => uid != notification.SenderId)
                .Select(uid => hubContext.Clients
                    .Group(MessengerHub.UserGroup(uid.ToString()))
                    .SendAsync("ReceiveMessage", payload, ct));
            await Task.WhenAll(tasks);
        }
    }
}

namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Modules.Messages.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Modules.Users.Application.Contracts;
using Microsoft.AspNetCore.SignalR;

public sealed class MessageSentEventHandler(
    IHubContext<MessengerHub> hubContext,
    IUsersModule usersModule,
    IChatsModule chatsModule,
    IMessagesModule messagesModule)
    : INotificationHandler<MessageSentDomainEvent>
{
    public async Task Handle(MessageSentDomainEvent notification, CancellationToken ct)
    {
        var membersTask = chatsModule.GetMemberIdsAsync(notification.ChatId, ct);

        MessagePreviewDto? replyTo = null;
        if (notification.ReplyToMessageId is { } replyId)
        {
            var replyResult = await messagesModule.GetMessagePreviewsByIdsAsync([replyId], ct);
            if (replyResult.IsSuccess) replyResult.Value!.TryGetValue(replyId, out replyTo);
        }

        var userIds = new List<Guid> { notification.SenderId };
        if (notification.ForwardedFromUserId is { } fwId) userIds.Add(fwId);
        if (replyTo is { } rt) userIds.Add(rt.SenderId);
        if (notification.TargetUserId is { } targetId) userIds.Add(targetId);

        var summariesResult = await usersModule.GetSummariesByAuthUserIdsAsync(userIds.Distinct().ToList(), ct);

        UserSummaryDto? sender = null;
        UserSummaryDto? forwardedFromUser = null;
        UserSummaryDto? replyToSender = null;
        UserSummaryDto? targetUser = null;
        if (summariesResult.IsSuccess)
        {
            var summaries = summariesResult.Value!;
            summaries.TryGetValue(notification.SenderId, out sender);
            if (notification.ForwardedFromUserId is { } id) summaries.TryGetValue(id, out forwardedFromUser);
            if (replyTo is { } rt2) summaries.TryGetValue(rt2.SenderId, out replyToSender);
            if (notification.TargetUserId is { } tid) summaries.TryGetValue(tid, out targetUser);
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
            attachments      = notification.Attachments
                .OrderBy(a => a.SortOrder)
                .Select(a => new
                {
                    fileUrl         = a.FileUrl,
                    fileName        = a.FileName,
                    fileContentType = a.ContentType,
                    fileSizeBytes   = a.FileSizeBytes,
                })
                .ToList(),
            forwardedFromUserId   = notification.ForwardedFromUserId,
            forwardedFromUserName = forwardedFromUser?.DisplayName,
            replyToMessageId   = notification.ReplyToMessageId,
            replyToSenderName  = replyToSender?.DisplayName,
            replyToContent     = replyTo is null ? null : (replyTo.IsDeleted ? null : MessagePreview.Truncate(replyTo.Content)),
            kind               = notification.Kind.ToString(),
            systemEventType    = notification.SystemEventType?.ToString(),
            targetUserId       = notification.TargetUserId,
            targetUserName     = targetUser?.DisplayName,
        };

        await ChatFallback.BroadcastToMembersAsync(
            hubContext, membersTask, "ReceiveMessage", payload, ct);
    }
}

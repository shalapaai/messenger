namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Chats.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Presence;
using Microsoft.AspNetCore.SignalR;

// Групповой чат создан / состав участников изменился / переименован —
// шлём в личные группы затронутых пользователей (чтобы их список чатов обновился без
// перезагрузки страницы) и в группу самого чата (чтобы открытая карточка группы обновилась)
public sealed class ChatUpdatedEventHandler(
    IHubContext<MessengerHub> hubContext,
    IChatMembershipChecker    membershipChecker,
    IPresenceTracker          presence)
    : INotificationHandler<ChatUpdatedDomainEvent>
{
    public async Task Handle(ChatUpdatedDomainEvent notification, CancellationToken ct)
    {
        var payload = new { chatId = notification.ChatId };

        var tasks = notification.AffectedUserIds
            .Select(uid => hubContext.Clients
                .Group(MessengerHub.UserGroup(uid.ToString()))
                .SendAsync("ChatUpdated", payload, ct))
            .Append(hubContext.Clients
                .Group(MessengerHub.ChatGroup(notification.ChatId))
                .SendAsync("ChatUpdated", payload, ct));

        await Task.WhenAll(tasks);

        // Исключённых из чата принудительно выводим из группы chat:{id}, иначе они продолжат
        // получать события чата, из которого их только что удалили.
        await EvictRemovedMembersAsync(notification.ChatId, notification.AffectedUserIds, ct);
    }

    private async Task EvictRemovedMembersAsync(Guid chatId, IReadOnlyList<Guid> affectedUserIds, CancellationToken ct)
    {
        var group = MessengerHub.ChatGroup(chatId);

        foreach (var userId in affectedUserIds)
        {
            if (await membershipChecker.IsMemberAsync(chatId, userId, ct))
                continue;

            var connections = await presence.GetConnectionsAsync(userId, ct);
            foreach (var connectionId in connections)
                await hubContext.Groups.RemoveFromGroupAsync(connectionId, group, ct);
        }
    }
}

namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Chats.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Presence;
using Microsoft.AspNetCore.SignalR;

// Групповой чат создан / состав участников изменился / переименован —
// шлём в личные группы затронутых пользователей, чтобы их список чатов и открытая
// карточка группы обновились без перезагрузки страницы. Личной группы одной достаточно —
// AffectedUserIds всегда включает всех текущих участников (+ удалённого при выходе/кике),
// так что группа чата здесь ничего не добавляет, а только дублирует событие тому, у кого
// эта карточка открыта прямо сейчас (та же причина, что у ReceiveMessage в MessageSentEventHandler).
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
                .SendAsync("ChatUpdated", payload, ct));

        await Task.WhenAll(tasks);

        // Кого из затронутых пользователей исключили из чата (а не просто обновили ростер
        // для оставшихся) — принудительно выводим их живые соединения из SignalR-группы
        // chat:{id}, иначе они продолжают получать ReceiveMessage/MessageEdited/... для
        // чата, из которого их только что удалили, пока сами не переподключатся.
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

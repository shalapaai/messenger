namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Chats.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Presence;
using Microsoft.AspNetCore.SignalR;

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

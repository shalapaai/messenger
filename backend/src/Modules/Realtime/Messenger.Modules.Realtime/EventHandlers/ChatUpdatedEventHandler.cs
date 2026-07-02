namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Chats.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Microsoft.AspNetCore.SignalR;

// Групповой чат создан / состав участников изменился / переименован —
// шлём в личные группы затронутых пользователей (чтобы их список чатов обновился без
// перезагрузки страницы) и в группу самого чата (чтобы открытая карточка группы обновилась)
public sealed class ChatUpdatedEventHandler(IHubContext<MessengerHub> hubContext)
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
    }
}

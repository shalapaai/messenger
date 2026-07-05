namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Chats.Domain.Events;
using Messenger.Modules.Realtime.Hubs;
using Microsoft.AspNetCore.SignalR;

// Групповой чат создан / состав участников изменился / переименован —
// шлём в личные группы затронутых пользователей, чтобы их список чатов и открытая
// карточка группы обновились без перезагрузки страницы. Личной группы одной достаточно —
// AffectedUserIds всегда включает всех текущих участников (+ удалённого при выходе/кике),
// так что группа чата здесь ничего не добавляет, а только дублирует событие тому, у кого
// эта карточка открыта прямо сейчас (та же причина, что у ReceiveMessage в MessageSentEventHandler).
public sealed class ChatUpdatedEventHandler(IHubContext<MessengerHub> hubContext)
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
    }
}

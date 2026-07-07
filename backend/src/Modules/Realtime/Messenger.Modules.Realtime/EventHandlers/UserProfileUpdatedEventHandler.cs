namespace Messenger.Modules.Realtime.EventHandlers;

using MediatR;
using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Modules.Users.Domain.Events;
using Microsoft.AspNetCore.SignalR;

// Имя/аватарка/цвет профиля изменились — рассылаем во все чаты пользователя, чтобы уже
// отрисованные список чатов и история сообщений обновили резолвленные данные отправителя.
public sealed class UserProfileUpdatedEventHandler(
    IHubContext<MessengerHub> hubContext,
    IChatsModule              chatsModule)
    : INotificationHandler<UserProfileUpdatedDomainEvent>
{
    public async Task Handle(UserProfileUpdatedDomainEvent notification, CancellationToken ct)
    {
        var chatIdsResult = await chatsModule.GetChatIdsByUserIdAsync(notification.AuthUserId, ct);
        if (chatIdsResult.IsFailure) return;

        var payload = new
        {
            userId      = notification.AuthUserId,
            displayName = notification.DisplayName,
            avatarUrl   = notification.AvatarUrl,
            avatarColor = notification.AvatarColor,
        };

        var tasks = chatIdsResult.Value!.Select(chatId =>
            hubContext.Clients.Group(MessengerHub.ChatGroup(chatId)).SendAsync("UserProfileUpdated", payload, ct));
        await Task.WhenAll(tasks);
    }
}

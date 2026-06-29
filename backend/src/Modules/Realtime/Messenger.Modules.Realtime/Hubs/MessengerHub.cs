namespace Messenger.Modules.Realtime.Hubs;

using MediatR;
using Messenger.Modules.Messages.Application.Features.SendMessage;
using Messenger.Shared.Kernel.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

[Authorize]
public sealed class MessengerHub(ISender sender, ILogger<MessengerHub> logger) : Hub
{
    // ── Подписка на чат ───────────────────────────────────────────────────────
    public async Task JoinChat(Guid chatId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, ChatGroup(chatId));
        logger.LogDebug("User {UserId} joined chat {ChatId}", Context.UserIdentifier, chatId);
    }

    public async Task LeaveChat(Guid chatId) =>
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, ChatGroup(chatId));

    // ── Отправка сообщения через WebSocket ────────────────────────────────────
    // Альтернатива HTTP POST — меньше latency, особенно на мобильных
    public async Task<SendMessageResult> SendMessage(SendMessageRequest request)
    {
        var userId = Guid.Parse(Context.UserIdentifier!);
        var command = new SendMessageCommand(request.ChatId, userId, request.Content, request.ReplyToMessageId);
        var result  = await sender.Send(command);

        if (result.IsFailure)
            throw new HubException(result.Error.Description);

        // ReceiveMessage рассылается автоматически через MessageSentEventHandler
        return new SendMessageResult(result.Value);
    }

    // ── Typing indicator ──────────────────────────────────────────────────────
    public async Task StartTyping(Guid chatId)
    {
        var userId = Context.UserIdentifier!;
        await Clients.OthersInGroup(ChatGroup(chatId))
            .SendAsync("UserTyping", new { UserId = userId, ChatId = chatId });
    }

    public async Task StopTyping(Guid chatId)
    {
        var userId = Context.UserIdentifier!;
        await Clients.OthersInGroup(ChatGroup(chatId))
            .SendAsync("UserStoppedTyping", new { UserId = userId, ChatId = chatId });
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier!;
        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(userId));
        // Оповещаем контакты — пользователь онлайн
        await Clients.Group(UserGroup(userId))
            .SendAsync("UserOnline", new { UserId = userId, IsOnline = true });

        logger.LogInformation("User {UserId} connected", userId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier!;
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, UserGroup(userId));
        await Clients.Group(UserGroup(userId))
            .SendAsync("UserOnline", new { UserId = userId, IsOnline = false });

        if (exception is not null)
            logger.LogWarning(exception, "User {UserId} disconnected with error", userId);
        else
            logger.LogDebug("User {UserId} disconnected", userId);

        await base.OnDisconnectedAsync(exception);
    }

    // ── Группы ────────────────────────────────────────────────────────────────
    public static string ChatGroup(Guid chatId)   => $"chat:{chatId}";
    public static string UserGroup(string userId) => $"user:{userId}";
}

public sealed record SendMessageRequest(Guid ChatId, string Content, Guid? ReplyToMessageId = null);
public sealed record SendMessageResult(Guid MessageId);

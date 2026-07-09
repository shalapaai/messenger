namespace Messenger.Modules.Realtime.Hubs;

using MediatR;
using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Messages.Application.Features.SendMessage;
using Messenger.Shared.Kernel.Extensions;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Presence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

[Authorize]
public sealed class MessengerHub(
    ISender                 sender,
    IChatsModule            chatsModule,
    IChatMembershipChecker  membershipChecker,
    IPresenceTracker        presence,
    ILogger<MessengerHub>   logger) : Hub
{
    public async Task JoinChat(Guid chatId)
    {
        var userId = Guid.Parse(Context.UserIdentifier!);
        if (!await membershipChecker.IsMemberAsync(chatId, userId))
            throw new HubException("You are not a member of this chat");

        await Groups.AddToGroupAsync(Context.ConnectionId, ChatGroup(chatId));
        logger.LogDebug("User {UserId} joined chat {ChatId}", Context.UserIdentifier, chatId);
    }

    public async Task LeaveChat(Guid chatId) =>
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, ChatGroup(chatId));

    public async Task<SendMessageResult> SendMessage(SendMessageRequest request)
    {
        var userId = Guid.Parse(Context.UserIdentifier!);
        var command = new SendMessageCommand(request.ChatId, userId, request.Content, request.ReplyToMessageId);
        var result  = await sender.Send(command);

        if (result.IsFailure)
            throw new HubException(result.Error.Description);

        return new SendMessageResult(result.Value);
    }

    public async Task StartTyping(Guid chatId)
    {
        var userId = Context.UserIdentifier!;
        if (!await membershipChecker.IsMemberAsync(chatId, Guid.Parse(userId)))
            throw new HubException("You are not a member of this chat");

        await Clients.OthersInGroup(ChatGroup(chatId))
            .SendAsync("UserTyping", new { UserId = userId, ChatId = chatId });
    }

    public async Task StopTyping(Guid chatId)
    {
        var userId = Context.UserIdentifier!;
        if (!await membershipChecker.IsMemberAsync(chatId, Guid.Parse(userId)))
            throw new HubException("You are not a member of this chat");

        await Clients.OthersInGroup(ChatGroup(chatId))
            .SendAsync("UserStoppedTyping", new { UserId = userId, ChatId = chatId });
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier!;
        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(userId));

        var connectionCount = await presence.ConnectAsync(Guid.Parse(userId), Context.ConnectionId);

        logger.LogInformation("User {UserId} connected", userId);
        await base.OnConnectedAsync();

        if (connectionCount == 1)
            await BroadcastOnlineStatus(userId, isOnline: true);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier!;
        long connectionCount;

        try
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, UserGroup(userId));
        }
        finally
        {
            connectionCount = await presence.DisconnectAsync(Guid.Parse(userId), Context.ConnectionId);
        }

        if (exception is not null)
            logger.LogWarning(exception, "User {UserId} disconnected with error", userId);
        else
            logger.LogDebug("User {UserId} disconnected", userId);

        await base.OnDisconnectedAsync(exception);

        if (connectionCount <= 0)
            await BroadcastOnlineStatus(userId, isOnline: false);
    }

    private async Task BroadcastOnlineStatus(string userId, bool isOnline)
    {
        var chatIdsResult = await chatsModule.GetChatIdsByUserIdAsync(Guid.Parse(userId));
        if (chatIdsResult.IsFailure) return;

        var tasks = chatIdsResult.Value!.Select(chatId =>
            Clients.Group(ChatGroup(chatId)).SendAsync("UserOnline", new { UserId = userId, IsOnline = isOnline }));
        await Task.WhenAll(tasks);
    }

    public static string ChatGroup(Guid chatId)   => $"chat:{chatId}";
    public static string UserGroup(string userId) => $"user:{userId}";
}

public sealed record SendMessageRequest(Guid ChatId, string Content, Guid? ReplyToMessageId = null);
public sealed record SendMessageResult(Guid MessageId);

namespace Messenger.Modules.Realtime.UnitTests.Hubs;

using MediatR;
using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Messages.Application.Features.SendMessage;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Presence;
using Messenger.Shared.Kernel.Results;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

public sealed class MessengerHubTests
{
    private readonly ISender                 _sender            = Substitute.For<ISender>();
    private readonly IChatsModule            _chatsModule       = Substitute.For<IChatsModule>();
    private readonly IChatMembershipChecker  _membershipChecker = Substitute.For<IChatMembershipChecker>();
    private readonly IPresenceTracker        _presence          = Substitute.For<IPresenceTracker>();
    private readonly ILogger<MessengerHub>   _logger            = Substitute.For<ILogger<MessengerHub>>();

    private readonly HubCallerContext     _context      = Substitute.For<HubCallerContext>();
    private readonly IHubCallerClients    _callerClients = Substitute.For<IHubCallerClients>();
    private readonly IGroupManager        _groupManager  = Substitute.For<IGroupManager>();
    private readonly IClientProxy         _clientProxy   = Substitute.For<IClientProxy>();

    private readonly Guid   _userId = Guid.NewGuid();
    private readonly MessengerHub _sut;

    public MessengerHubTests()
    {
        _context.UserIdentifier.Returns(_userId.ToString());
        _context.ConnectionId.Returns("conn-1");

        _callerClients.OthersInGroup(Arg.Any<string>()).Returns(_clientProxy);
        _callerClients.Group(Arg.Any<string>()).Returns(_clientProxy);

        _sut = new MessengerHub(_sender, _chatsModule, _membershipChecker, _presence, _logger)
        {
            Context = _context,
            Clients = _callerClients,
            Groups  = _groupManager,
        };
    }

    [Fact]
    public async Task JoinChat_WhenNotMember_ThrowsHubException()
    {
        var chatId = Guid.NewGuid();
        _membershipChecker.IsMemberAsync(chatId, _userId, Arg.Any<CancellationToken>()).Returns(false);

        var act = () => _sut.JoinChat(chatId);

        await act.Should().ThrowAsync<HubException>();
        await _groupManager.DidNotReceive().AddToGroupAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task JoinChat_WhenMember_AddsConnectionToChatGroup()
    {
        var chatId = Guid.NewGuid();
        _membershipChecker.IsMemberAsync(chatId, _userId, Arg.Any<CancellationToken>()).Returns(true);

        await _sut.JoinChat(chatId);

        await _groupManager.Received(1).AddToGroupAsync(
            "conn-1", MessengerHub.ChatGroup(chatId), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task LeaveChat_RemovesConnectionFromGroup_WithoutMembershipCheck()
    {
        var chatId = Guid.NewGuid();

        await _sut.LeaveChat(chatId);

        await _groupManager.Received(1).RemoveFromGroupAsync(
            "conn-1", MessengerHub.ChatGroup(chatId), Arg.Any<CancellationToken>());
        await _membershipChecker.DidNotReceive().IsMemberAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SendMessage_OnSuccess_ReturnsSendMessageResultWithMessageId()
    {
        var chatId    = Guid.NewGuid();
        var messageId = Guid.NewGuid();
        _sender.Send(Arg.Any<SendMessageCommand>(), Arg.Any<CancellationToken>())
            .Returns(Result.Success(messageId));

        var request = new SendMessageRequest(chatId, "hello");
        var result  = await _sut.SendMessage(request);

        result.MessageId.Should().Be(messageId);
    }

    [Fact]
    public async Task SendMessage_OnFailure_ThrowsHubExceptionWithErrorDescription()
    {
        var request = new SendMessageRequest(Guid.NewGuid(), "hello");
        _sender.Send(Arg.Any<SendMessageCommand>(), Arg.Any<CancellationToken>())
            .Returns(Result.Failure<Guid>(Error.NotFound("Chat")));

        var act = () => _sut.SendMessage(request);

        var exception = await act.Should().ThrowAsync<HubException>();
        exception.Which.Message.Should().Be(Error.NotFound("Chat").Description);
    }

    [Fact]
    public async Task StartTyping_WhenNotMember_ThrowsHubException()
    {
        var chatId = Guid.NewGuid();
        _membershipChecker.IsMemberAsync(chatId, _userId, Arg.Any<CancellationToken>()).Returns(false);

        var act = () => _sut.StartTyping(chatId);

        await act.Should().ThrowAsync<HubException>();
    }

    [Fact]
    public async Task StartTyping_WhenMember_SendsUserTypingToOthersInGroup()
    {
        var chatId = Guid.NewGuid();
        _membershipChecker.IsMemberAsync(chatId, _userId, Arg.Any<CancellationToken>()).Returns(true);

        await _sut.StartTyping(chatId);

        _callerClients.Received(1).OthersInGroup(MessengerHub.ChatGroup(chatId));
        await _clientProxy.Received(1).SendCoreAsync("UserTyping", Arg.Any<object?[]>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StopTyping_WhenNotMember_ThrowsHubException()
    {
        var chatId = Guid.NewGuid();
        _membershipChecker.IsMemberAsync(chatId, _userId, Arg.Any<CancellationToken>()).Returns(false);

        var act = () => _sut.StopTyping(chatId);

        await act.Should().ThrowAsync<HubException>();
    }

    [Fact]
    public async Task StopTyping_WhenMember_SendsUserStoppedTypingToOthersInGroup()
    {
        var chatId = Guid.NewGuid();
        _membershipChecker.IsMemberAsync(chatId, _userId, Arg.Any<CancellationToken>()).Returns(true);

        await _sut.StopTyping(chatId);

        _callerClients.Received(1).OthersInGroup(MessengerHub.ChatGroup(chatId));
        await _clientProxy.Received(1).SendCoreAsync("UserStoppedTyping", Arg.Any<object?[]>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OnConnectedAsync_AddsConnectionToUserGroup()
    {
        _presence.ConnectAsync(_userId, "conn-1", Arg.Any<CancellationToken>()).Returns(1L);
        _chatsModule.GetChatIdsByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new List<Guid>()));

        await _sut.OnConnectedAsync();

        await _groupManager.Received(1).AddToGroupAsync(
            "conn-1", MessengerHub.UserGroup(_userId.ToString()), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OnConnectedAsync_WhenFirstConnection_BroadcastsUserOnlineToUsersChatGroups()
    {
        var chatOne = Guid.NewGuid();
        var chatTwo = Guid.NewGuid();
        _presence.ConnectAsync(_userId, "conn-1", Arg.Any<CancellationToken>()).Returns(1L);
        _chatsModule.GetChatIdsByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new List<Guid> { chatOne, chatTwo }));

        await _sut.OnConnectedAsync();

        _callerClients.Received(1).Group(MessengerHub.ChatGroup(chatOne));
        _callerClients.Received(1).Group(MessengerHub.ChatGroup(chatTwo));
        await _clientProxy.Received(2).SendCoreAsync("UserOnline", Arg.Any<object?[]>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OnConnectedAsync_WhenNotFirstConnection_DoesNotBroadcastUserOnline()
    {
        _presence.ConnectAsync(_userId, "conn-1", Arg.Any<CancellationToken>()).Returns(2L);

        await _sut.OnConnectedAsync();

        await _chatsModule.DidNotReceive().GetChatIdsByUserIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await _clientProxy.DidNotReceive().SendCoreAsync(
            "UserOnline", Arg.Any<object?[]>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OnDisconnectedAsync_RemovesConnectionFromUserGroup()
    {
        _presence.DisconnectAsync(_userId, "conn-1", Arg.Any<CancellationToken>()).Returns(1L);

        await _sut.OnDisconnectedAsync(null);

        await _groupManager.Received(1).RemoveFromGroupAsync(
            "conn-1", MessengerHub.UserGroup(_userId.ToString()), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OnDisconnectedAsync_WhenGroupRemovalThrows_StillCallsPresenceDisconnect()
    {
        _groupManager.RemoveFromGroupAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new InvalidOperationException("redis unavailable"));
        _presence.DisconnectAsync(_userId, "conn-1", Arg.Any<CancellationToken>()).Returns(0L);

        var act = () => _sut.OnDisconnectedAsync(null);

        await act.Should().ThrowAsync<InvalidOperationException>();
        await _presence.Received(1).DisconnectAsync(_userId, "conn-1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OnDisconnectedAsync_WhenConnectionCountReachesZero_BroadcastsUserOffline()
    {
        var chatId = Guid.NewGuid();
        _presence.DisconnectAsync(_userId, "conn-1", Arg.Any<CancellationToken>()).Returns(0L);
        _chatsModule.GetChatIdsByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new List<Guid> { chatId }));

        await _sut.OnDisconnectedAsync(null);

        _callerClients.Received(1).Group(MessengerHub.ChatGroup(chatId));
        await _clientProxy.Received(1).SendCoreAsync("UserOnline", Arg.Any<object?[]>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OnDisconnectedAsync_WhenStillOtherConnectionsRemain_DoesNotBroadcastUserOffline()
    {
        _presence.DisconnectAsync(_userId, "conn-1", Arg.Any<CancellationToken>()).Returns(1L);

        await _sut.OnDisconnectedAsync(null);

        await _chatsModule.DidNotReceive().GetChatIdsByUserIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }
}

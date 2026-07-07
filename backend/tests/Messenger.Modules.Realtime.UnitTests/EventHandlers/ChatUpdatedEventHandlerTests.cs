namespace Messenger.Modules.Realtime.UnitTests.EventHandlers;

using Messenger.Modules.Chats.Domain.Events;
using Messenger.Modules.Realtime.EventHandlers;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Presence;
using Microsoft.AspNetCore.SignalR;

public sealed class ChatUpdatedEventHandlerTests
{
    private readonly IHubContext<MessengerHub> _hubContext         = Substitute.For<IHubContext<MessengerHub>>();
    private readonly IChatMembershipChecker    _membershipChecker  = Substitute.For<IChatMembershipChecker>();
    private readonly IPresenceTracker          _presence           = Substitute.For<IPresenceTracker>();
    private readonly IClientProxy              _clientProxy        = Substitute.For<IClientProxy>();
    private readonly IHubClients               _hubClients         = Substitute.For<IHubClients>();
    private readonly IGroupManager             _groupManager       = Substitute.For<IGroupManager>();
    private readonly ChatUpdatedEventHandler _sut;

    public ChatUpdatedEventHandlerTests()
    {
        _hubClients.Group(Arg.Any<string>()).Returns(_clientProxy);
        _hubContext.Clients.Returns(_hubClients);
        _hubContext.Groups.Returns(_groupManager);

        _membershipChecker.IsMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(true);

        _sut = new ChatUpdatedEventHandler(_hubContext, _membershipChecker, _presence);
    }

    [Fact]
    public async Task Handle_SendsChatUpdatedToEachAffectedUsersPersonalGroup()
    {
        var chatId = Guid.NewGuid();
        var userOne = Guid.NewGuid();
        var userTwo = Guid.NewGuid();
        var notification = new ChatUpdatedDomainEvent(chatId, new List<Guid> { userOne, userTwo });

        await _sut.Handle(notification, CancellationToken.None);

        _hubClients.Received(1).Group(MessengerHub.UserGroup(userOne.ToString()));
        _hubClients.Received(1).Group(MessengerHub.UserGroup(userTwo.ToString()));
        // 2 personal groups, all resolved to the same mocked proxy
        await _clientProxy.Received(2).SendCoreAsync("ChatUpdated", Arg.Any<object?[]>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_DoesNotSendToChatGroupDirectly()
    {
        // AffectedUserIds всегда содержит всех текущих участников — рассылка по личным группам
        // уже покрывает всех, отдельная рассылка в группу чата была бы дублем (см. комментарий
        // в ChatUpdatedEventHandler).
        var chatId = Guid.NewGuid();
        var notification = new ChatUpdatedDomainEvent(chatId, new List<Guid> { Guid.NewGuid() });

        await _sut.Handle(notification, CancellationToken.None);

        _hubClients.DidNotReceive().Group(MessengerHub.ChatGroup(chatId));
    }

    [Fact]
    public async Task Handle_WhenAffectedUserNoLongerMember_RemovesTheirConnectionsFromChatGroup()
    {
        var chatId       = Guid.NewGuid();
        var removedUser  = Guid.NewGuid();
        var remainingUser = Guid.NewGuid();
        _membershipChecker.IsMemberAsync(chatId, removedUser, Arg.Any<CancellationToken>()).Returns(false);
        _membershipChecker.IsMemberAsync(chatId, remainingUser, Arg.Any<CancellationToken>()).Returns(true);
        _presence.GetConnectionsAsync(removedUser, Arg.Any<CancellationToken>())
            .Returns(new List<string> { "conn-1", "conn-2" });

        var notification = new ChatUpdatedDomainEvent(chatId, new List<Guid> { removedUser, remainingUser });

        await _sut.Handle(notification, CancellationToken.None);

        var chatGroup = MessengerHub.ChatGroup(chatId);
        await _groupManager.Received(1).RemoveFromGroupAsync("conn-1", chatGroup, Arg.Any<CancellationToken>());
        await _groupManager.Received(1).RemoveFromGroupAsync("conn-2", chatGroup, Arg.Any<CancellationToken>());
        await _presence.DidNotReceive().GetConnectionsAsync(remainingUser, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenAllAffectedUsersStillMembers_DoesNotRemoveAnyConnections()
    {
        var chatId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var notification = new ChatUpdatedDomainEvent(chatId, new List<Guid> { userId });

        await _sut.Handle(notification, CancellationToken.None);

        await _groupManager.DidNotReceive().RemoveFromGroupAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }
}

namespace Messenger.Modules.Realtime.UnitTests.EventHandlers;

using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Chats.Domain.Events;
using Messenger.Modules.Realtime.EventHandlers;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Shared.Kernel.Results;
using Microsoft.AspNetCore.SignalR;

public sealed class ChatReadEventHandlerTests
{
    private readonly IHubContext<MessengerHub> _hubContext  = Substitute.For<IHubContext<MessengerHub>>();
    private readonly IChatsModule               _chatsModule = Substitute.For<IChatsModule>();
    private readonly IClientProxy               _clientProxy = Substitute.For<IClientProxy>();
    private readonly IHubClients                _hubClients  = Substitute.For<IHubClients>();
    private readonly ChatReadEventHandler _sut;

    public ChatReadEventHandlerTests()
    {
        _hubClients.Group(Arg.Any<string>()).Returns(_clientProxy);
        _hubContext.Clients.Returns(_hubClients);

        _chatsModule.GetMemberIdsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Result.Success(new List<Guid>()));

        _sut = new ChatReadEventHandler(_hubContext, _chatsModule);
    }

    [Fact]
    public async Task Handle_SendsToMembers_ViaFallback()
    {
        var chatId    = Guid.NewGuid();
        var memberOne = Guid.NewGuid();
        var memberTwo = Guid.NewGuid();
        _chatsModule.GetMemberIdsAsync(chatId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new List<Guid> { memberOne, memberTwo }));

        var notification = new ChatReadDomainEvent(chatId, Guid.NewGuid(), DateTime.UtcNow);

        await _sut.Handle(notification, CancellationToken.None);

        _hubClients.Received(1).Group(MessengerHub.UserGroup(memberOne.ToString()));
        _hubClients.Received(1).Group(MessengerHub.UserGroup(memberTwo.ToString()));
        await _clientProxy.Received(2).SendCoreAsync("MessagesRead", Arg.Any<object?[]>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenMembersLookupFails_SendsNothing()
    {
        // MessagesRead больше не дублируется через chat:{id}-группу — единственный путь доставки
        // это ChatFallback, который зависит от успешного GetMemberIdsAsync.
        var chatId = Guid.NewGuid();
        _chatsModule.GetMemberIdsAsync(chatId, Arg.Any<CancellationToken>())
            .Returns(Result.Failure<List<Guid>>(Error.NotFound("Chat")));

        var notification = new ChatReadDomainEvent(chatId, Guid.NewGuid(), DateTime.UtcNow);

        await _sut.Handle(notification, CancellationToken.None);

        await _clientProxy.DidNotReceive().SendCoreAsync(
            "MessagesRead", Arg.Any<object?[]>(), Arg.Any<CancellationToken>());
    }
}

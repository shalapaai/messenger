namespace Messenger.Modules.Realtime.UnitTests.EventHandlers;

using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Messages.Domain.Events;
using Messenger.Modules.Realtime.EventHandlers;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Shared.Kernel.Results;
using Microsoft.AspNetCore.SignalR;

public sealed class MessageEditedEventHandlerTests
{
    private readonly IHubContext<MessengerHub> _hubContext  = Substitute.For<IHubContext<MessengerHub>>();
    private readonly IChatsModule               _chatsModule = Substitute.For<IChatsModule>();
    private readonly IClientProxy               _clientProxy = Substitute.For<IClientProxy>();
    private readonly IHubClients                _hubClients  = Substitute.For<IHubClients>();
    private readonly MessageEditedEventHandler _sut;

    public MessageEditedEventHandlerTests()
    {
        _hubClients.Group(Arg.Any<string>()).Returns(_clientProxy);
        _hubContext.Clients.Returns(_hubClients);

        _chatsModule.GetMemberIdsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Result.Success(new List<Guid>()));

        _sut = new MessageEditedEventHandler(_hubContext, _chatsModule);
    }

    [Fact]
    public async Task Handle_SendsMessageEditedToChatGroup()
    {
        var chatId = Guid.NewGuid();
        var notification = new MessageEditedDomainEvent(Guid.NewGuid(), chatId, "new content");

        await _sut.Handle(notification, CancellationToken.None);

        _hubClients.Received(1).Group(MessengerHub.ChatGroup(chatId));
        await _clientProxy.Received(1).SendCoreAsync("MessageEdited", Arg.Any<object?[]>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_SendsToMembers_ViaFallback()
    {
        var chatId    = Guid.NewGuid();
        var memberOne = Guid.NewGuid();
        var memberTwo = Guid.NewGuid();
        _chatsModule.GetMemberIdsAsync(chatId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new List<Guid> { memberOne, memberTwo }));

        var notification = new MessageEditedDomainEvent(Guid.NewGuid(), chatId, "new content");

        await _sut.Handle(notification, CancellationToken.None);

        _hubClients.Received(1).Group(MessengerHub.UserGroup(memberOne.ToString()));
        _hubClients.Received(1).Group(MessengerHub.UserGroup(memberTwo.ToString()));
    }

    [Fact]
    public async Task Handle_WhenMembersLookupFails_StillSendsToChatGroup()
    {
        var chatId = Guid.NewGuid();
        _chatsModule.GetMemberIdsAsync(chatId, Arg.Any<CancellationToken>())
            .Returns(Result.Failure<List<Guid>>(Error.NotFound("Chat")));

        var notification = new MessageEditedDomainEvent(Guid.NewGuid(), chatId, "new content");

        await _sut.Handle(notification, CancellationToken.None);

        await _clientProxy.Received(1).SendCoreAsync("MessageEdited", Arg.Any<object?[]>(), Arg.Any<CancellationToken>());
    }
}

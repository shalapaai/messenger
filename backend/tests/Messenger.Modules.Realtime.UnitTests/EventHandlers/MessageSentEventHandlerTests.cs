namespace Messenger.Modules.Realtime.UnitTests.EventHandlers;

using Messenger.Modules.Chats.Application.Contracts;
using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Modules.Messages.Domain.Events;
using Messenger.Modules.Realtime.EventHandlers;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Modules.Users.Application.Contracts;
using Messenger.Shared.Kernel.Results;
using Microsoft.AspNetCore.SignalR;

public sealed class MessageSentEventHandlerTests
{
    private readonly IHubContext<MessengerHub> _hubContext   = Substitute.For<IHubContext<MessengerHub>>();
    private readonly IUsersModule              _usersModule    = Substitute.For<IUsersModule>();
    private readonly IChatsModule               _chatsModule    = Substitute.For<IChatsModule>();
    private readonly IMessagesModule            _messagesModule = Substitute.For<IMessagesModule>();
    private readonly IClientProxy               _clientProxy    = Substitute.For<IClientProxy>();
    private readonly IHubClients                _hubClients     = Substitute.For<IHubClients>();
    private readonly MessageSentEventHandler _sut;

    public MessageSentEventHandlerTests()
    {
        _hubClients.Group(Arg.Any<string>()).Returns(_clientProxy);
        _hubContext.Clients.Returns(_hubClients);

        _chatsModule.GetMemberIdsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Result.Success(new List<Guid>()));
        _usersModule.GetSummariesByAuthUserIdsAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Result.Success(new Dictionary<Guid, UserSummaryDto>()));

        _sut = new MessageSentEventHandler(_hubContext, _usersModule, _chatsModule, _messagesModule);
    }

    [Fact]
    public async Task Handle_SendsReceiveMessageToChatGroup()
    {
        var chatId = Guid.NewGuid();
        var notification = new MessageSentDomainEvent(Guid.NewGuid(), chatId, Guid.NewGuid(), "hello");

        await _sut.Handle(notification, CancellationToken.None);

        _hubClients.Received(1).Group(MessengerHub.ChatGroup(chatId));
        await _clientProxy.Received(1).SendCoreAsync("ReceiveMessage", Arg.Any<object?[]>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_SendsToMembersExceptSender_ViaFallback()
    {
        var chatId    = Guid.NewGuid();
        var senderId  = Guid.NewGuid();
        var memberOne = Guid.NewGuid();
        var memberTwo = Guid.NewGuid();
        _chatsModule.GetMemberIdsAsync(chatId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new List<Guid> { senderId, memberOne, memberTwo }));

        var notification = new MessageSentDomainEvent(Guid.NewGuid(), chatId, senderId, "hello");

        await _sut.Handle(notification, CancellationToken.None);

        _hubClients.DidNotReceive().Group(MessengerHub.UserGroup(senderId.ToString()));
        _hubClients.Received(1).Group(MessengerHub.UserGroup(memberOne.ToString()));
        _hubClients.Received(1).Group(MessengerHub.UserGroup(memberTwo.ToString()));
    }

    [Fact]
    public async Task Handle_WithReplyToMessageId_ResolvesReplyPreview()
    {
        var chatId  = Guid.NewGuid();
        var replyId = Guid.NewGuid();
        var replySenderId = Guid.NewGuid();
        _messagesModule.GetMessagePreviewsByIdsAsync(
                Arg.Is<IReadOnlyList<Guid>>(ids => ids.Contains(replyId)), Arg.Any<CancellationToken>())
            .Returns(Result.Success(new Dictionary<Guid, MessagePreviewDto>
            {
                [replyId] = new MessagePreviewDto(replyId, replySenderId, "original text", false)
            }));

        var notification = new MessageSentDomainEvent(
            Guid.NewGuid(), chatId, Guid.NewGuid(), "hello", replyToMessageId: replyId);

        await _sut.Handle(notification, CancellationToken.None);

        await _messagesModule.Received(1).GetMessagePreviewsByIdsAsync(
            Arg.Is<IReadOnlyList<Guid>>(ids => ids.Contains(replyId)), Arg.Any<CancellationToken>());
        await _clientProxy.Received(1).SendCoreAsync(
            "ReceiveMessage",
            Arg.Is<object?[]>(args => (Guid?)args[0]!.GetType().GetProperty("replyToMessageId")!.GetValue(args[0]) == replyId),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenSenderLookupFails_FallsBackToDefaultSenderName()
    {
        _usersModule.GetSummariesByAuthUserIdsAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Result.Failure<Dictionary<Guid, UserSummaryDto>>(Error.NotFound("User")));

        var notification = new MessageSentDomainEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "hello");

        await _sut.Handle(notification, CancellationToken.None);

        await _clientProxy.Received(1).SendCoreAsync(
            "ReceiveMessage",
            Arg.Is<object?[]>(args => (string)args[0]!.GetType().GetProperty("senderName")!.GetValue(args[0])! == "Пользователь"),
            Arg.Any<CancellationToken>());
    }
}

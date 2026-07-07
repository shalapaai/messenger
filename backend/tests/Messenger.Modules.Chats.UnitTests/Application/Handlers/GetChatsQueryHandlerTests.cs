namespace Messenger.Modules.Chats.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Chats.Application.Features.GetChats;
using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Modules.Users.Application.Contracts;
using Messenger.Shared.Kernel.Presence;
using Messenger.Shared.Kernel.Results;
using NSubstitute;

public sealed class GetChatsQueryHandlerTests
{
    private readonly IChatRepository  _chatRepository = Substitute.For<IChatRepository>();
    private readonly IMessagesModule  _messagesModule = Substitute.For<IMessagesModule>();
    private readonly IUsersModule     _usersModule    = Substitute.For<IUsersModule>();
    private readonly IPresenceTracker _presence       = Substitute.For<IPresenceTracker>();
    private readonly GetChatsQueryHandler _sut;

    public GetChatsQueryHandlerTests()
    {
        _sut = new GetChatsQueryHandler(_chatRepository, _messagesModule, _usersModule, _presence);

        _messagesModule.GetLastMessagesByChatIdsAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
                        .Returns(Result.Success(new Dictionary<Guid, LastMessageDto>()));
        _messagesModule.GetUnreadCountsByChatIdsAsync(
                            Arg.Any<Guid>(), Arg.Any<IReadOnlyDictionary<Guid, DateTime?>>(), Arg.Any<CancellationToken>())
                        .Returns(Result.Success(new Dictionary<Guid, int>()));
        _usersModule.GetSummariesByAuthUserIdsAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
                    .Returns(Result.Success(new Dictionary<Guid, UserSummaryDto>()));
        _presence.GetOnlineAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
                 .Returns(new HashSet<Guid>());
    }

    [Fact]
    public async Task Handle_DirectChatWithoutOwnName_ResolvesOtherUserDisplayNameAndAvatar()
    {
        var currentUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var chat = Chat.CreateDirect(currentUserId, otherUserId);
        chat.AddMember(currentUserId);
        chat.AddMember(otherUserId);
        _chatRepository.GetByUserIdAsync(currentUserId, Arg.Any<CancellationToken>()).Returns([chat]);

        var summaries = new Dictionary<Guid, UserSummaryDto>
        {
            [otherUserId] = new UserSummaryDto(otherUserId, "Other User", "https://avatar.png", "#ABCDEF"),
        };
        _usersModule.GetSummariesByAuthUserIdsAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
                    .Returns(Result.Success(summaries));
        _presence.GetOnlineAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
                 .Returns(new HashSet<Guid> { otherUserId });

        var query = new GetChatsQuery(currentUserId);
        var result = await _sut.Handle(query, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var summaryDto = result.Value!.Single();
        summaryDto.Name.Should().Be("Other User");
        summaryDto.AvatarUrl.Should().Be("https://avatar.png");
        summaryDto.AvatarColor.Should().Be("#ABCDEF");
        summaryDto.OtherUserId.Should().Be(otherUserId);
        summaryDto.IsOnline.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_GroupChat_DisplayNameIsChatOwnName()
    {
        var currentUserId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Team Chat").Value!;
        chat.AddMember(currentUserId, ChatMemberRole.Owner);
        _chatRepository.GetByUserIdAsync(currentUserId, Arg.Any<CancellationToken>()).Returns([chat]);

        var query = new GetChatsQuery(currentUserId);
        var result = await _sut.Handle(query, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var summaryDto = result.Value!.Single();
        summaryDto.Name.Should().Be("Team Chat");
        summaryDto.OtherUserId.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WiresUnreadCountFromMessagesModule()
    {
        var currentUserId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Team Chat").Value!;
        chat.AddMember(currentUserId, ChatMemberRole.Owner);
        _chatRepository.GetByUserIdAsync(currentUserId, Arg.Any<CancellationToken>()).Returns([chat]);
        _messagesModule.GetUnreadCountsByChatIdsAsync(
                            currentUserId, Arg.Any<IReadOnlyDictionary<Guid, DateTime?>>(), Arg.Any<CancellationToken>())
                        .Returns(Result.Success(new Dictionary<Guid, int> { [chat.Id.Value] = 7 }));

        var query = new GetChatsQuery(currentUserId);
        var result = await _sut.Handle(query, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Single().UnreadCount.Should().Be(7);
    }

    [Fact]
    public async Task Handle_WiresLastMessageSummaryFromMessagesModule()
    {
        var currentUserId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Team Chat").Value!;
        chat.AddMember(currentUserId, ChatMemberRole.Owner);
        _chatRepository.GetByUserIdAsync(currentUserId, Arg.Any<CancellationToken>()).Returns([chat]);
        var lastMessage = new LastMessageDto(Guid.NewGuid(), currentUserId, "Hello", DateTime.UtcNow, false, null, null, null, "Text");
        _messagesModule.GetLastMessagesByChatIdsAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
                        .Returns(Result.Success(new Dictionary<Guid, LastMessageDto> { [chat.Id.Value] = lastMessage }));

        var query = new GetChatsQuery(currentUserId);
        var result = await _sut.Handle(query, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Single().LastMessage.Should().Be(lastMessage);
    }

    [Fact]
    public async Task Handle_OrdersChatsByLastMessageSentAtDescending()
    {
        var currentUserId = Guid.NewGuid();
        var olderChat = Chat.CreateGroup("Older").Value!;
        olderChat.AddMember(currentUserId, ChatMemberRole.Owner);
        var newerChat = Chat.CreateGroup("Newer").Value!;
        newerChat.AddMember(currentUserId, ChatMemberRole.Owner);
        _chatRepository.GetByUserIdAsync(currentUserId, Arg.Any<CancellationToken>()).Returns([olderChat, newerChat]);

        var olderMessage = new LastMessageDto(Guid.NewGuid(), currentUserId, "Old", DateTime.UtcNow.AddMinutes(-10), false, null, null, null, "Text");
        var newerMessage = new LastMessageDto(Guid.NewGuid(), currentUserId, "New", DateTime.UtcNow, false, null, null, null, "Text");
        _messagesModule.GetLastMessagesByChatIdsAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
                        .Returns(Result.Success(new Dictionary<Guid, LastMessageDto>
                        {
                            [olderChat.Id.Value] = olderMessage,
                            [newerChat.Id.Value] = newerMessage,
                        }));

        var query = new GetChatsQuery(currentUserId);
        var result = await _sut.Handle(query, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Select(c => c.Name).Should().ContainInOrder("Newer", "Older");
    }

    [Fact]
    public async Task Handle_MessagesModuleFailsToGetLastMessages_PropagatesFailure()
    {
        var currentUserId = Guid.NewGuid();
        _chatRepository.GetByUserIdAsync(currentUserId, Arg.Any<CancellationToken>()).Returns([]);
        _messagesModule.GetLastMessagesByChatIdsAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
                        .Returns(Result.Failure<Dictionary<Guid, LastMessageDto>>(new Error("Messages.Error", "boom")));

        var query = new GetChatsQuery(currentUserId);
        var result = await _sut.Handle(query, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Messages.Error");
    }
}

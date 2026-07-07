namespace Messenger.Modules.Chats.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Chats.Application.Features.GetChatById;
using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Users.Application.Contracts;
using Messenger.Shared.Kernel.Presence;
using Messenger.Shared.Kernel.Results;
using NSubstitute;

public sealed class GetChatByIdQueryHandlerTests
{
    private readonly IChatRepository  _chatRepository = Substitute.For<IChatRepository>();
    private readonly IUsersModule     _usersModule    = Substitute.For<IUsersModule>();
    private readonly IPresenceTracker _presence       = Substitute.For<IPresenceTracker>();
    private readonly GetChatByIdQueryHandler _sut;

    public GetChatByIdQueryHandlerTests()
    {
        _sut = new GetChatByIdQueryHandler(_chatRepository, _usersModule, _presence);
    }

    [Fact]
    public async Task Handle_ChatNotFound_ReturnsNotFound()
    {
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns((Chat?)null);

        var query = new GetChatByIdQuery(Guid.NewGuid(), Guid.NewGuid());
        var result = await _sut.Handle(query, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Handle_CurrentUserNotAMember_ReturnsForbidden()
    {
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(Guid.NewGuid(), ChatMemberRole.Owner);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var query = new GetChatByIdQuery(Guid.NewGuid(), Guid.NewGuid());
        var result = await _sut.Handle(query, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public async Task Handle_ValidRequest_ReturnsChatDetailWithMemberInfo()
    {
        var currentUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(currentUserId, ChatMemberRole.Owner);
        chat.AddMember(otherUserId, ChatMemberRole.Member);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var summaries = new Dictionary<Guid, UserSummaryDto>
        {
            [otherUserId] = new UserSummaryDto(otherUserId, "Other User", "https://avatar.png", "#ABCDEF"),
        };
        _usersModule.GetSummariesByAuthUserIdsAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
                    .Returns(Result.Success(summaries));
        _presence.GetOnlineAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
                 .Returns(new HashSet<Guid> { otherUserId });

        var query = new GetChatByIdQuery(Guid.NewGuid(), currentUserId);
        var result = await _sut.Handle(query, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Members.Should().HaveCount(2);
        var otherMemberDto = result.Value!.Members.Single(m => m.UserId == otherUserId);
        otherMemberDto.DisplayName.Should().Be("Other User");
        otherMemberDto.Online.Should().BeTrue();
        var currentMemberDto = result.Value!.Members.Single(m => m.UserId == currentUserId);
        currentMemberDto.Online.Should().BeFalse();
        currentMemberDto.DisplayName.Should().Be("Пользователь");
    }

    [Fact]
    public async Task Handle_UsersModuleFails_PropagatesFailure()
    {
        var currentUserId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(currentUserId, ChatMemberRole.Owner);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        _usersModule.GetSummariesByAuthUserIdsAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
                    .Returns(Result.Failure<Dictionary<Guid, UserSummaryDto>>(new Error("Users.Error", "boom")));
        _presence.GetOnlineAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
                 .Returns(new HashSet<Guid>());

        var query = new GetChatByIdQuery(Guid.NewGuid(), currentUserId);
        var result = await _sut.Handle(query, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Users.Error");
    }
}

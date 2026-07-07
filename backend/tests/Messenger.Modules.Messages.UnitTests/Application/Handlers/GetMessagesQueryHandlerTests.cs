namespace Messenger.Modules.Messages.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Messages.Application.Features.GetMessages;
using Messenger.Modules.Messages.Domain;
using Messenger.Modules.Users.Application.Contracts;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;
using NSubstitute;

public sealed class GetMessagesQueryHandlerTests
{
    private readonly IMessageRepository     _messageRepository = Substitute.For<IMessageRepository>();
    private readonly IUsersModule           _usersModule       = Substitute.For<IUsersModule>();
    private readonly IChatMembershipChecker _membershipChecker = Substitute.For<IChatMembershipChecker>();
    private readonly GetMessagesQueryHandler _sut;

    public GetMessagesQueryHandlerTests()
    {
        _sut = new GetMessagesQueryHandler(_messageRepository, _usersModule, _membershipChecker);

        _usersModule.GetSummariesByAuthUserIdsAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Result.Success(new Dictionary<Guid, UserSummaryDto>()));
        _messageRepository.GetByChatIdCursorAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new List<Message>());
    }

    [Fact]
    public async Task Handle_WhenNotAMember_ReturnsForbidden()
    {
        var chatId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var query = new GetMessagesQuery(chatId, userId, null);
        _membershipChecker.IsMemberAsync(chatId, userId, Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.Handle(query, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
    }

    [Theory]
    [InlineData(0, 2)]
    [InlineData(-5, 2)]
    [InlineData(1, 2)]
    public async Task Handle_ClampsLimitToMinimumOfOne(int requestedLimit, int expectedRepositoryLimit)
    {
        var chatId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var query = new GetMessagesQuery(chatId, userId, null, requestedLimit);
        _membershipChecker.IsMemberAsync(chatId, userId, Arg.Any<CancellationToken>()).Returns(true);

        await _sut.Handle(query, CancellationToken.None);

        await _messageRepository.Received(1)
            .GetByChatIdCursorAsync(chatId, null, expectedRepositoryLimit, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(100, 101)]
    [InlineData(500, 101)]
    public async Task Handle_ClampsLimitToMaximumOf100(int requestedLimit, int expectedRepositoryLimit)
    {
        var chatId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var query = new GetMessagesQuery(chatId, userId, null, requestedLimit);
        _membershipChecker.IsMemberAsync(chatId, userId, Arg.Any<CancellationToken>()).Returns(true);

        await _sut.Handle(query, CancellationToken.None);

        await _messageRepository.Received(1)
            .GetByChatIdCursorAsync(chatId, null, expectedRepositoryLimit, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenRepositoryReturnsMoreThanLimit_SetsHasMoreAndNextCursor()
    {
        var chatId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var query = new GetMessagesQuery(chatId, userId, null, 2);
        _membershipChecker.IsMemberAsync(chatId, userId, Arg.Any<CancellationToken>()).Returns(true);

        var m1 = Message.Create(chatId, Guid.NewGuid(), "one").Value!;
        var m2 = Message.Create(chatId, Guid.NewGuid(), "two").Value!;
        var m3 = Message.Create(chatId, Guid.NewGuid(), "three").Value!;
        // repository is asked for limit+1=3 rows to detect whether a further page exists
        _messageRepository.GetByChatIdCursorAsync(chatId, null, 3, Arg.Any<CancellationToken>())
            .Returns(new List<Message> { m1, m2, m3 });

        var result = await _sut.Handle(query, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value!.NextCursor.Should().Be(m2.Id.Value);
    }

    [Fact]
    public async Task Handle_WhenRepositoryReturnsExactlyLimit_HasNoMorePages()
    {
        var chatId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var query = new GetMessagesQuery(chatId, userId, null, 2);
        _membershipChecker.IsMemberAsync(chatId, userId, Arg.Any<CancellationToken>()).Returns(true);

        var m1 = Message.Create(chatId, Guid.NewGuid(), "one").Value!;
        var m2 = Message.Create(chatId, Guid.NewGuid(), "two").Value!;
        _messageRepository.GetByChatIdCursorAsync(chatId, null, 3, Arg.Any<CancellationToken>())
            .Returns(new List<Message> { m1, m2 });

        var result = await _sut.Handle(query, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value!.NextCursor.Should().BeNull();
    }

    [Fact]
    public async Task Handle_ResolvesReplyPreview_ForMessageWithExistingNonDeletedReplySource()
    {
        var chatId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var replySenderId = Guid.NewGuid();
        var replySource = Message.Create(chatId, replySenderId, "original text").Value!;
        var reply = Message.Create(chatId, Guid.NewGuid(), "replying", replySource.Id.Value).Value!;

        var query = new GetMessagesQuery(chatId, userId, null, 10);
        _membershipChecker.IsMemberAsync(chatId, userId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByChatIdCursorAsync(chatId, null, 11, Arg.Any<CancellationToken>())
            .Returns(new List<Message> { reply });
        _messageRepository.GetByIdsAsync(Arg.Is<IEnumerable<MessageId>>(ids => ids.Contains(replySource.Id)), Arg.Any<CancellationToken>())
            .Returns(new List<Message> { replySource });
        _usersModule.GetSummariesByAuthUserIdsAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Result.Success(new Dictionary<Guid, UserSummaryDto>
            {
                [replySenderId] = new UserSummaryDto(replySenderId, "Reply Author", null, "#000000"),
            }));

        var result = await _sut.Handle(query, CancellationToken.None);

        var dto = result.Value!.Items.Single();
        dto.ReplyToSenderName.Should().Be("Reply Author");
        dto.ReplyToContent.Should().Be("original text");
    }

    [Fact]
    public async Task Handle_WhenReplySourceIsDeleted_ReturnsNullReplyContentButStillResolvesSenderName()
    {
        var chatId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var replySenderId = Guid.NewGuid();
        var replySource = Message.Create(chatId, replySenderId, "original text").Value!;
        replySource.Delete();
        var reply = Message.Create(chatId, Guid.NewGuid(), "replying", replySource.Id.Value).Value!;

        var query = new GetMessagesQuery(chatId, userId, null, 10);
        _membershipChecker.IsMemberAsync(chatId, userId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByChatIdCursorAsync(chatId, null, 11, Arg.Any<CancellationToken>())
            .Returns(new List<Message> { reply });
        _messageRepository.GetByIdsAsync(Arg.Is<IEnumerable<MessageId>>(ids => ids.Contains(replySource.Id)), Arg.Any<CancellationToken>())
            .Returns(new List<Message> { replySource });
        _usersModule.GetSummariesByAuthUserIdsAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Result.Success(new Dictionary<Guid, UserSummaryDto>
            {
                [replySenderId] = new UserSummaryDto(replySenderId, "Reply Author", null, "#000000"),
            }));

        var result = await _sut.Handle(query, CancellationToken.None);

        var dto = result.Value!.Items.Single();
        dto.ReplyToSenderName.Should().Be("Reply Author");
        dto.ReplyToContent.Should().BeNull();
    }
}

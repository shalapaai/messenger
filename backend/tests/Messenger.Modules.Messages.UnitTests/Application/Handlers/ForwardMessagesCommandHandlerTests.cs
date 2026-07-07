namespace Messenger.Modules.Messages.UnitTests.Application.Handlers;

using System.Reflection;
using FluentAssertions;
using Messenger.Modules.Messages.Application;
using Messenger.Modules.Messages.Application.Features.ForwardMessages;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;
using NSubstitute;

public sealed class ForwardMessagesCommandHandlerTests
{
    private readonly IMessageRepository     _messageRepository = Substitute.For<IMessageRepository>();
    private readonly IChatMembershipChecker _membershipChecker = Substitute.For<IChatMembershipChecker>();
    private readonly IUnitOfWork            _unitOfWork        = Substitute.For<IUnitOfWork>();
    private readonly ForwardMessagesCommandHandler _sut;

    public ForwardMessagesCommandHandlerTests()
    {
        _sut = new ForwardMessagesCommandHandler(_messageRepository, _membershipChecker, _unitOfWork);
    }

    // Message.SentAt has no public setter — needed here to force a deterministic ordering
    // between two messages created back-to-back in the same test.
    private static void SetSentAt(Message message, DateTime sentAt) =>
        typeof(Message).GetProperty(nameof(Message.SentAt))!.SetValue(message, sentAt);

    // Message.Create/CreateWithAttachments both enforce "non-empty content OR at least one
    // attachment" as an invariant, and Delete()'d (empty-content) messages are filtered out by
    // the handler before reaching CreateForwarded. So a real, persisted Message can never reach
    // CreateForwarded with both empty content and no attachments through the public API — the
    // only way to exercise the handler's defensive "skip empty copy" branch is to fabricate a
    // corrupted instance the way EF Core would materialize one from bad legacy data.
    private static Message CreateCorruptedEmptyMessage(Guid chatId, Guid senderId)
    {
        var ctor = typeof(Message).GetConstructor(BindingFlags.NonPublic | BindingFlags.Instance, null, Type.EmptyTypes, null)!;
        var message = (Message)ctor.Invoke(null);

        SetProperty(message, nameof(Message.Id), MessageId.New());
        SetProperty(message, nameof(Message.ChatId), chatId);
        SetProperty(message, nameof(Message.SenderId), senderId);
        SetProperty(message, nameof(Message.Content), string.Empty);
        SetProperty(message, nameof(Message.Status), MessageStatus.Sent);
        SetProperty(message, nameof(Message.SentAt), DateTime.UtcNow);

        return message;
    }

    private static void SetProperty(Message message, string propertyName, object value) =>
        typeof(Message).GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance)!.SetValue(message, value);

    [Fact]
    public async Task Handle_WithEmptyMessageIdsList_ReturnsValidationFailure()
    {
        var command = new ForwardMessagesCommand([], Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public async Task Handle_WhenNotMemberOfSourceChat_ReturnsForbidden()
    {
        var sourceChatId = Guid.NewGuid();
        var targetChatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var command = new ForwardMessagesCommand([Guid.NewGuid()], sourceChatId, targetChatId, requesterId);
        _membershipChecker.IsMemberAsync(sourceChatId, requesterId, Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public async Task Handle_WhenNotMemberOfTargetChat_ReturnsForbidden()
    {
        var sourceChatId = Guid.NewGuid();
        var targetChatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var command = new ForwardMessagesCommand([Guid.NewGuid()], sourceChatId, targetChatId, requesterId);
        _membershipChecker.IsMemberAsync(sourceChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _membershipChecker.IsMemberAsync(targetChatId, requesterId, Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public async Task Handle_WhenNoRequestedIdsResolveToRealNonDeletedMessagesFromSourceChat_ReturnsNotFound()
    {
        var sourceChatId = Guid.NewGuid();
        var targetChatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var fromOtherChat = Message.Create(Guid.NewGuid(), Guid.NewGuid(), "wrong chat").Value!;
        var deletedInSourceChat = Message.Create(sourceChatId, Guid.NewGuid(), "deleted").Value!;
        deletedInSourceChat.Delete();
        var command = new ForwardMessagesCommand(
            [fromOtherChat.Id.Value, deletedInSourceChat.Id.Value], sourceChatId, targetChatId, requesterId);
        _membershipChecker.IsMemberAsync(sourceChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _membershipChecker.IsMemberAsync(targetChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByIdsAsync(Arg.Any<IEnumerable<MessageId>>(), Arg.Any<CancellationToken>())
            .Returns(new List<Message> { fromOtherChat, deletedInSourceChat });

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Handle_OrdersForwardedMessages_BySentAtNotRequestOrder()
    {
        var sourceChatId = Guid.NewGuid();
        var targetChatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();

        var older = Message.Create(sourceChatId, Guid.NewGuid(), "older message").Value!;
        SetSentAt(older, DateTime.UtcNow.AddMinutes(-10));
        var newer = Message.Create(sourceChatId, Guid.NewGuid(), "newer message").Value!;

        var command = new ForwardMessagesCommand([newer.Id.Value, older.Id.Value], sourceChatId, targetChatId, requesterId);
        _membershipChecker.IsMemberAsync(sourceChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _membershipChecker.IsMemberAsync(targetChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByIdsAsync(Arg.Any<IEnumerable<MessageId>>(), Arg.Any<CancellationToken>())
            .Returns(new List<Message> { newer, older });

        var added = new List<Message>();
        _messageRepository.When(r => r.Add(Arg.Any<Message>())).Do(ci => added.Add(ci.Arg<Message>()));

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        added.Should().HaveCount(2);
        added[0].ForwardedFromMessageId.Should().Be(older.Id.Value);
        added[1].ForwardedFromMessageId.Should().Be(newer.Id.Value);
        result.Value.Should().Equal(added[0].Id.Value, added[1].Id.Value);
    }

    [Fact]
    public async Task Handle_ForwardingAnAlreadyForwardedMessage_CreditsTheOriginalAuthor()
    {
        var sourceChatId = Guid.NewGuid();
        var targetChatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var originalAuthorId = Guid.NewGuid();
        var firstForwarderId = Guid.NewGuid();

        // Simulate a message that was already forwarded once before: its SenderId is the first
        // forwarder, but ForwardedFromUserId still points at the true original author.
        var alreadyForwarded = Message.CreateForwarded(
            sourceChatId, firstForwarderId, "hello", [], Guid.NewGuid(), originalAuthorId).Value!;

        var command = new ForwardMessagesCommand([alreadyForwarded.Id.Value], sourceChatId, targetChatId, requesterId);
        _membershipChecker.IsMemberAsync(sourceChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _membershipChecker.IsMemberAsync(targetChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByIdsAsync(Arg.Any<IEnumerable<MessageId>>(), Arg.Any<CancellationToken>())
            .Returns(new List<Message> { alreadyForwarded });

        Message? added = null;
        _messageRepository.When(r => r.Add(Arg.Any<Message>())).Do(ci => added = ci.Arg<Message>());

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        added.Should().NotBeNull();
        added!.ForwardedFromUserId.Should().Be(originalAuthorId);
        added.ForwardedFromUserId.Should().NotBe(firstForwarderId);
        added.SenderId.Should().Be(requesterId);
    }

    [Fact]
    public async Task Handle_SkipsCopiesThatEndUpEmpty_WithoutFailingTheBatch()
    {
        var sourceChatId = Guid.NewGuid();
        var targetChatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();

        var valid = Message.Create(sourceChatId, Guid.NewGuid(), "valid message").Value!;
        var corruptedEmpty = CreateCorruptedEmptyMessage(sourceChatId, Guid.NewGuid());

        var command = new ForwardMessagesCommand(
            [valid.Id.Value, corruptedEmpty.Id.Value], sourceChatId, targetChatId, requesterId);
        _membershipChecker.IsMemberAsync(sourceChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _membershipChecker.IsMemberAsync(targetChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByIdsAsync(Arg.Any<IEnumerable<MessageId>>(), Arg.Any<CancellationToken>())
            .Returns(new List<Message> { valid, corruptedEmpty });

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().ContainSingle();
    }

    [Fact]
    public async Task Handle_WhenAllCopiesEndUpEmpty_ReturnsValidationNothingToForward()
    {
        var sourceChatId = Guid.NewGuid();
        var targetChatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();

        var corruptedEmpty = CreateCorruptedEmptyMessage(sourceChatId, Guid.NewGuid());

        var command = new ForwardMessagesCommand([corruptedEmpty.Id.Value], sourceChatId, targetChatId, requesterId);
        _membershipChecker.IsMemberAsync(sourceChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _membershipChecker.IsMemberAsync(targetChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByIdsAsync(Arg.Any<IEnumerable<MessageId>>(), Arg.Any<CancellationToken>())
            .Returns(new List<Message> { corruptedEmpty });

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
        result.Error.Description.Should().Be("Nothing to forward");
    }
}

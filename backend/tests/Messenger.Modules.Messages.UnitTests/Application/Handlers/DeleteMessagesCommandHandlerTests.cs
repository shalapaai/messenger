namespace Messenger.Modules.Messages.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Messages.Application;
using Messenger.Modules.Messages.Application.Features.DeleteMessages;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

public sealed class DeleteMessagesCommandHandlerTests
{
    private readonly IMessageRepository     _messageRepository = Substitute.For<IMessageRepository>();
    private readonly IChatMembershipChecker _membershipChecker = Substitute.For<IChatMembershipChecker>();
    private readonly IUnitOfWork            _unitOfWork        = Substitute.For<IUnitOfWork>();
    private readonly DeleteMessagesCommandHandler _sut;

    public DeleteMessagesCommandHandlerTests()
    {
        _sut = new DeleteMessagesCommandHandler(_messageRepository, _membershipChecker, _unitOfWork);
    }

    [Fact]
    public async Task Handle_WithEmptyMessageIdsList_ReturnsValidationFailure()
    {
        var command = new DeleteMessagesCommand(Guid.NewGuid(), [], Guid.NewGuid());

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public async Task Handle_WhenNotAMember_ReturnsForbidden()
    {
        var chatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var command = new DeleteMessagesCommand(chatId, [Guid.NewGuid()], requesterId);
        _membershipChecker.IsMemberAsync(chatId, requesterId, Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public async Task Handle_SkipsMessagesFromDifferentChatThanCommandChatId()
    {
        var chatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var inChat = Message.Create(chatId, Guid.NewGuid(), "in chat").Value!;
        var otherChat = Message.Create(Guid.NewGuid(), Guid.NewGuid(), "other chat").Value!;
        var command = new DeleteMessagesCommand(chatId, [inChat.Id.Value, otherChat.Id.Value], requesterId);
        _membershipChecker.IsMemberAsync(chatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByIdsAsync(Arg.Any<IEnumerable<MessageId>>(), Arg.Any<CancellationToken>())
            .Returns(new List<Message> { inChat, otherChat });

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().ContainSingle().Which.Should().Be(inChat.Id.Value);
        otherChat.Status.Should().Be(MessageStatus.Sent);
        _messageRepository.DidNotReceive().Update(otherChat);
    }

    [Fact]
    public async Task Handle_SkipsAlreadyDeletedMessagesWithoutFailingTheBatch()
    {
        var chatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var alreadyDeleted = Message.Create(chatId, Guid.NewGuid(), "already deleted").Value!;
        alreadyDeleted.Delete();
        var deletable = Message.Create(chatId, Guid.NewGuid(), "still there").Value!;
        var command = new DeleteMessagesCommand(chatId, [alreadyDeleted.Id.Value, deletable.Id.Value], requesterId);
        _membershipChecker.IsMemberAsync(chatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByIdsAsync(Arg.Any<IEnumerable<MessageId>>(), Arg.Any<CancellationToken>())
            .Returns(new List<Message> { alreadyDeleted, deletable });

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().ContainSingle().Which.Should().Be(deletable.Id.Value);
    }

    [Fact]
    public async Task Handle_WhenAllRequestedIdsAlreadyDeleted_IsIdempotentAndReturnsEmptySuccess()
    {
        // Повторный bulk-delete по тем же id — идемпотентный no-op (id принадлежат чату,
        // просто уже удалены), а не 404: клиент уже достиг желаемого результата.
        var chatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var alreadyDeleted = Message.Create(chatId, Guid.NewGuid(), "already deleted").Value!;
        alreadyDeleted.Delete();
        var command = new DeleteMessagesCommand(chatId, [alreadyDeleted.Id.Value], requesterId);
        _membershipChecker.IsMemberAsync(chatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByIdsAsync(Arg.Any<IEnumerable<MessageId>>(), Arg.Any<CancellationToken>())
            .Returns(new List<Message> { alreadyDeleted });

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_WhenNoRequestedIdsBelongToThisChat_ReturnsNotFound()
    {
        var chatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var fromOtherChat = Message.Create(Guid.NewGuid(), Guid.NewGuid(), "wrong chat").Value!;
        var command = new DeleteMessagesCommand(chatId, [fromOtherChat.Id.Value], requesterId);
        _membershipChecker.IsMemberAsync(chatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByIdsAsync(Arg.Any<IEnumerable<MessageId>>(), Arg.Any<CancellationToken>())
            .Returns(new List<Message> { fromOtherChat });

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Handle_OnSuccess_ReturnsDeletedIdsAndSavesChanges()
    {
        var chatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var first = Message.Create(chatId, Guid.NewGuid(), "first").Value!;
        var second = Message.Create(chatId, Guid.NewGuid(), "second").Value!;
        var command = new DeleteMessagesCommand(chatId, [first.Id.Value, second.Id.Value], requesterId);
        _membershipChecker.IsMemberAsync(chatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByIdsAsync(Arg.Any<IEnumerable<MessageId>>(), Arg.Any<CancellationToken>())
            .Returns(new List<Message> { first, second });

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEquivalentTo([first.Id.Value, second.Id.Value]);
        first.Status.Should().Be(MessageStatus.Deleted);
        second.Status.Should().Be(MessageStatus.Deleted);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenSaveChangesThrowsConcurrencyException_ReturnsConflict()
    {
        var chatId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var deletable = Message.Create(chatId, Guid.NewGuid(), "hello").Value!;
        var command = new DeleteMessagesCommand(chatId, [deletable.Id.Value], requesterId);
        _membershipChecker.IsMemberAsync(chatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByIdsAsync(Arg.Any<IEnumerable<MessageId>>(), Arg.Any<CancellationToken>())
            .Returns(new List<Message> { deletable });
        _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns<int>(_ => throw new DbUpdateConcurrencyException());

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Conflict);
    }
}

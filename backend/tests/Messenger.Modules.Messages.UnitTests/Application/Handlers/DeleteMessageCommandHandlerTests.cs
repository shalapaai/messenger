namespace Messenger.Modules.Messages.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Messages.Application;
using Messenger.Modules.Messages.Application.Features.DeleteMessage;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

public sealed class DeleteMessageCommandHandlerTests
{
    private readonly IMessageRepository     _messageRepository = Substitute.For<IMessageRepository>();
    private readonly IChatMembershipChecker _membershipChecker = Substitute.For<IChatMembershipChecker>();
    private readonly IUnitOfWork            _unitOfWork        = Substitute.For<IUnitOfWork>();
    private readonly DeleteMessageCommandHandler _sut;

    public DeleteMessageCommandHandlerTests()
    {
        _sut = new DeleteMessageCommandHandler(_messageRepository, _membershipChecker, _unitOfWork);
    }

    [Fact]
    public async Task Handle_WhenMessageNotFound_ReturnsNotFound()
    {
        var messageId = Guid.NewGuid();
        var command = new DeleteMessageCommand(messageId, Guid.NewGuid());
        _messageRepository.GetByIdAsync(MessageId.From(messageId), Arg.Any<CancellationToken>()).Returns((Message?)null);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Handle_WhenRequesterIsNotChatMember_ReturnsForbidden_EvenWhenNotOriginalSender()
    {
        // Deletion is allowed for any chat member, not just the sender — so this asserts the
        // failure comes from the membership check, not from an "only sender" rule like Edit has.
        var senderId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var message = Message.Create(Guid.NewGuid(), senderId, "hello").Value!;
        var command = new DeleteMessageCommand(message.Id.Value, requesterId);
        _messageRepository.GetByIdAsync(message.Id, Arg.Any<CancellationToken>()).Returns(message);
        _membershipChecker.IsMemberAsync(message.ChatId, requesterId, Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public async Task Handle_WhenAlreadyDeleted_PropagatesAlreadyDeletedFailure()
    {
        var senderId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var message = Message.Create(Guid.NewGuid(), senderId, "hello").Value!;
        message.Delete();
        var command = new DeleteMessageCommand(message.Id.Value, requesterId);
        _messageRepository.GetByIdAsync(message.Id, Arg.Any<CancellationToken>()).Returns(message);
        _membershipChecker.IsMemberAsync(message.ChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Message.AlreadyDeleted");
    }

    [Fact]
    public async Task Handle_OnSuccess_UpdatesRepositoryAndSavesChanges()
    {
        var senderId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var message = Message.Create(Guid.NewGuid(), senderId, "hello").Value!;
        var command = new DeleteMessageCommand(message.Id.Value, requesterId);
        _messageRepository.GetByIdAsync(message.Id, Arg.Any<CancellationToken>()).Returns(message);
        _membershipChecker.IsMemberAsync(message.ChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        message.Status.Should().Be(MessageStatus.Deleted);
        _messageRepository.Received(1).Update(message);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenSaveChangesThrowsConcurrencyException_ReturnsConflict()
    {
        var senderId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var message = Message.Create(Guid.NewGuid(), senderId, "hello").Value!;
        var command = new DeleteMessageCommand(message.Id.Value, requesterId);
        _messageRepository.GetByIdAsync(message.Id, Arg.Any<CancellationToken>()).Returns(message);
        _membershipChecker.IsMemberAsync(message.ChatId, requesterId, Arg.Any<CancellationToken>()).Returns(true);
        _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns<int>(_ => throw new DbUpdateConcurrencyException());

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Conflict);
    }
}

namespace Messenger.Modules.Messages.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Messages.Application;
using Messenger.Modules.Messages.Application.Features.EditMessage;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

public sealed class EditMessageCommandHandlerTests
{
    private readonly IMessageRepository     _messageRepository = Substitute.For<IMessageRepository>();
    private readonly IChatMembershipChecker _membershipChecker = Substitute.For<IChatMembershipChecker>();
    private readonly IUnitOfWork            _unitOfWork        = Substitute.For<IUnitOfWork>();
    private readonly EditMessageCommandHandler _sut;

    public EditMessageCommandHandlerTests()
    {
        _membershipChecker.IsMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(true);
        _sut = new EditMessageCommandHandler(_messageRepository, _membershipChecker, _unitOfWork);
    }

    [Fact]
    public async Task Handle_WhenMessageNotFound_ReturnsNotFound()
    {
        var messageId = Guid.NewGuid();
        var command = new EditMessageCommand(messageId, Guid.NewGuid(), "new content");
        _messageRepository.GetByIdAsync(MessageId.From(messageId), Arg.Any<CancellationToken>()).Returns((Message?)null);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Handle_WhenRequesterIsNotSender_PropagatesForbiddenFailure()
    {
        var senderId = Guid.NewGuid();
        var message = Message.Create(Guid.NewGuid(), senderId, "hello").Value!;
        var command = new EditMessageCommand(message.Id.Value, Guid.NewGuid(), "new content");
        _messageRepository.GetByIdAsync(message.Id, Arg.Any<CancellationToken>()).Returns(message);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
        _messageRepository.DidNotReceive().Update(Arg.Any<Message>());
    }

    [Fact]
    public async Task Handle_OnSuccess_UpdatesRepositoryAndSavesChanges()
    {
        var senderId = Guid.NewGuid();
        var message = Message.Create(Guid.NewGuid(), senderId, "hello").Value!;
        var command = new EditMessageCommand(message.Id.Value, senderId, "updated content");
        _messageRepository.GetByIdAsync(message.Id, Arg.Any<CancellationToken>()).Returns(message);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        message.Content.Should().Be("updated content");
        _messageRepository.Received(1).Update(message);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenSaveChangesThrowsConcurrencyException_ReturnsConflict()
    {
        var senderId = Guid.NewGuid();
        var message = Message.Create(Guid.NewGuid(), senderId, "hello").Value!;
        var command = new EditMessageCommand(message.Id.Value, senderId, "updated content");
        _messageRepository.GetByIdAsync(message.Id, Arg.Any<CancellationToken>()).Returns(message);
        _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns<int>(_ => throw new DbUpdateConcurrencyException());

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Conflict);
    }
}

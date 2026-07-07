namespace Messenger.Modules.Messages.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Messages.Application;
using Messenger.Modules.Messages.Application.Features.SendMessage;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;
using NSubstitute;

public sealed class SendMessageCommandHandlerTests
{
    private readonly IMessageRepository     _messageRepository = Substitute.For<IMessageRepository>();
    private readonly IChatMembershipChecker _membershipChecker = Substitute.For<IChatMembershipChecker>();
    private readonly IUnitOfWork            _unitOfWork        = Substitute.For<IUnitOfWork>();
    private readonly SendMessageCommandHandler _sut;

    public SendMessageCommandHandlerTests()
    {
        _sut = new SendMessageCommandHandler(_messageRepository, _membershipChecker, _unitOfWork);
    }

    [Fact]
    public async Task Handle_WhenNotAMember_ReturnsForbidden()
    {
        var command = new SendMessageCommand(Guid.NewGuid(), Guid.NewGuid(), "hello");
        _membershipChecker.IsMemberAsync(command.ChatId, command.SenderId, Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public async Task Handle_WhenReplyToMessageIsFromDifferentChat_ReturnsValidationFailure()
    {
        var chatId = Guid.NewGuid();
        var replyToMessageId = Guid.NewGuid();
        var replyTarget = Message.Create(Guid.NewGuid(), Guid.NewGuid(), "other chat message").Value!;
        var command = new SendMessageCommand(chatId, Guid.NewGuid(), "hello", replyToMessageId);

        _membershipChecker.IsMemberAsync(chatId, command.SenderId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByIdAsync(MessageId.From(replyToMessageId), Arg.Any<CancellationToken>()).Returns(replyTarget);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public async Task Handle_WhenReplyToMessageDoesNotExist_ReturnsValidationFailure()
    {
        var chatId = Guid.NewGuid();
        var replyToMessageId = Guid.NewGuid();
        var command = new SendMessageCommand(chatId, Guid.NewGuid(), "hello", replyToMessageId);

        _membershipChecker.IsMemberAsync(chatId, command.SenderId, Arg.Any<CancellationToken>()).Returns(true);
        _messageRepository.GetByIdAsync(MessageId.From(replyToMessageId), Arg.Any<CancellationToken>()).Returns((Message?)null);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public async Task Handle_WithValidCommand_AddsMessageAndSavesChanges()
    {
        var chatId = Guid.NewGuid();
        var senderId = Guid.NewGuid();
        var command = new SendMessageCommand(chatId, senderId, "hello world");

        _membershipChecker.IsMemberAsync(chatId, senderId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBe(Guid.Empty);
        _messageRepository.Received(1).Add(Arg.Is<Message>(m => m.ChatId == chatId && m.SenderId == senderId && m.Content == "hello world"));
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

namespace Messenger.Modules.Chats.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Application.Features.DeleteChat;
using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Shared.Kernel.Results;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

public sealed class DeleteChatCommandHandlerTests
{
    private readonly IChatRepository _chatRepository = Substitute.For<IChatRepository>();
    private readonly IMessagesModule _messagesModule = Substitute.For<IMessagesModule>();
    private readonly IUnitOfWork     _uow            = Substitute.For<IUnitOfWork>();
    private readonly DeleteChatCommandHandler _sut;

    public DeleteChatCommandHandlerTests()
    {
        _sut = new DeleteChatCommandHandler(_chatRepository, _messagesModule, _uow);
    }

    [Fact]
    public async Task Handle_ChatNotFound_ReturnsNotFound()
    {
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns((Chat?)null);

        var command = new DeleteChatCommand(Guid.NewGuid(), Guid.NewGuid());
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Handle_GroupChat_ReturnsValidationFailure()
    {
        var requesterId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(requesterId, ChatMemberRole.Owner);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new DeleteChatCommand(Guid.NewGuid(), requesterId);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
        _chatRepository.DidNotReceive().Delete(Arg.Any<Chat>());
    }

    [Fact]
    public async Task Handle_RequesterNotAMember_ReturnsForbidden()
    {
        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();
        var chat = Chat.CreateDirect(userId1, userId2);
        chat.AddMember(userId1);
        chat.AddMember(userId2);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new DeleteChatCommand(Guid.NewGuid(), Guid.NewGuid());
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public async Task Handle_ValidRequest_DeletesChatAndSavesAndCleansUpMessages()
    {
        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();
        var chat = Chat.CreateDirect(userId1, userId2);
        chat.AddMember(userId1);
        chat.AddMember(userId2);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);
        _messagesModule.DeleteAllMessagesInChatAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
                       .Returns(Result.Success());

        var command = new DeleteChatCommand(Guid.NewGuid(), userId1);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        _chatRepository.Received(1).Delete(chat);
        await _uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await _messagesModule.Received(1).DeleteAllMessagesInChatAsync(command.ChatId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_MessagesModuleThrows_IsSwallowedAndResponseStillSuccess()
    {
        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();
        var chat = Chat.CreateDirect(userId1, userId2);
        chat.AddMember(userId1);
        chat.AddMember(userId2);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);
        _messagesModule.DeleteAllMessagesInChatAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
                       .ThrowsAsync(new InvalidOperationException("messages store unavailable"));

        var command = new DeleteChatCommand(Guid.NewGuid(), userId1);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        _chatRepository.Received(1).Delete(chat);
    }
}

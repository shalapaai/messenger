namespace Messenger.Modules.Chats.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Application.Features.RemoveChatMember;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Results;
using NSubstitute;

public sealed class RemoveChatMemberCommandHandlerTests
{
    private readonly IChatRepository _chatRepository = Substitute.For<IChatRepository>();
    private readonly IUnitOfWork     _uow            = Substitute.For<IUnitOfWork>();
    private readonly RemoveChatMemberCommandHandler _sut;

    public RemoveChatMemberCommandHandlerTests()
    {
        _sut = new RemoveChatMemberCommandHandler(_chatRepository, _uow);
    }

    [Fact]
    public async Task Handle_ChatNotFound_ReturnsNotFound()
    {
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns((Chat?)null);

        var command = new RemoveChatMemberCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Handle_DirectChat_ReturnsValidationFailure()
    {
        var chat = Chat.CreateDirect(Guid.NewGuid(), Guid.NewGuid());
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new RemoveChatMemberCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public async Task Handle_DomainRemoveMemberFails_PropagatesFailureWithoutSaving()
    {
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(Guid.NewGuid(), ChatMemberRole.Owner);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new RemoveChatMemberCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
        await _uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_LastMemberRemoved_ChatBecomesEmptyAndIsDeleted()
    {
        var ownerId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(ownerId, ChatMemberRole.Owner);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new RemoveChatMemberCommand(Guid.NewGuid(), ownerId, ownerId);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        chat.IsEmpty.Should().BeTrue();
        _chatRepository.Received(1).Delete(chat);
        await _uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_RemovingOneOfSeveralMembers_ChatIsNotDeleted()
    {
        var ownerId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(ownerId, ChatMemberRole.Owner);
        chat.AddMember(memberId, ChatMemberRole.Member);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new RemoveChatMemberCommand(Guid.NewGuid(), ownerId, memberId);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        _chatRepository.DidNotReceive().Delete(Arg.Any<Chat>());
        await _uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

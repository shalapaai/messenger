namespace Messenger.Modules.Chats.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Application.Features.AddChatMember;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

public sealed class AddChatMemberCommandHandlerTests
{
    private readonly IChatRepository _chatRepository = Substitute.For<IChatRepository>();
    private readonly IUnitOfWork     _uow            = Substitute.For<IUnitOfWork>();
    private readonly AddChatMemberCommandHandler _sut;

    public AddChatMemberCommandHandlerTests()
    {
        _sut = new AddChatMemberCommandHandler(_chatRepository, _uow);
    }

    [Fact]
    public async Task Handle_ChatNotFound_ReturnsNotFound()
    {
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns((Chat?)null);

        var command = new AddChatMemberCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Handle_DirectChat_ReturnsValidationFailure()
    {
        var chat = Chat.CreateDirect(Guid.NewGuid(), Guid.NewGuid());
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new AddChatMemberCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public async Task Handle_RequesterNotAMember_ReturnsForbidden()
    {
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(Guid.NewGuid(), ChatMemberRole.Owner);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new AddChatMemberCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public async Task Handle_RequesterIsPlainMember_ReturnsForbidden()
    {
        var requesterId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(requesterId, ChatMemberRole.Member);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new AddChatMemberCommand(Guid.NewGuid(), requesterId, Guid.NewGuid());
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public async Task Handle_UserAlreadyAMember_ReturnsValidationFailure()
    {
        var requesterId = Guid.NewGuid();
        var existingUserId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(requesterId, ChatMemberRole.Owner);
        chat.AddMember(existingUserId, ChatMemberRole.Member);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new AddChatMemberCommand(Guid.NewGuid(), requesterId, existingUserId);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public async Task Handle_ValidRequest_AddsMemberAndSaves()
    {
        var requesterId = Guid.NewGuid();
        var newUserId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(requesterId, ChatMemberRole.Owner);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new AddChatMemberCommand(Guid.NewGuid(), requesterId, newUserId);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        chat.Members.Should().Contain(m => m.UserId == newUserId);
        await _uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_SaveChangesThrowsDbUpdateException_ReturnsValidationFailure()
    {
        var requesterId = Guid.NewGuid();
        var newUserId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(requesterId, ChatMemberRole.Owner);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);
        _uow.SaveChangesAsync(Arg.Any<CancellationToken>()).ThrowsAsync(new DbUpdateException());

        var command = new AddChatMemberCommand(Guid.NewGuid(), requesterId, newUserId);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }
}

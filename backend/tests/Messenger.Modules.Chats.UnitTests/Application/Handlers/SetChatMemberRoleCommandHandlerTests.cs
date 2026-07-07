namespace Messenger.Modules.Chats.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Application.Features.SetChatMemberRole;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Results;
using NSubstitute;

public sealed class SetChatMemberRoleCommandHandlerTests
{
    private readonly IChatRepository _chatRepository = Substitute.For<IChatRepository>();
    private readonly IUnitOfWork     _uow            = Substitute.For<IUnitOfWork>();
    private readonly SetChatMemberRoleCommandHandler _sut;

    public SetChatMemberRoleCommandHandlerTests()
    {
        _sut = new SetChatMemberRoleCommandHandler(_chatRepository, _uow);
    }

    [Fact]
    public async Task Handle_ChatNotFound_ReturnsNotFound()
    {
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns((Chat?)null);

        var command = new SetChatMemberRoleCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Admin");
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Handle_DirectChat_ReturnsValidationFailure()
    {
        var chat = Chat.CreateDirect(Guid.NewGuid(), Guid.NewGuid());
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new SetChatMemberRoleCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Admin");
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public async Task Handle_UnparseableRole_ReturnsValidationFailure()
    {
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(Guid.NewGuid(), ChatMemberRole.Owner);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new SetChatMemberRoleCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "SuperAdmin");
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public async Task Handle_RequestedRoleIsOwner_ReturnsValidationFailureBeforeCallingDomain()
    {
        var ownerId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(ownerId, ChatMemberRole.Owner);
        chat.AddMember(targetId, ChatMemberRole.Member);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new SetChatMemberRoleCommand(Guid.NewGuid(), ownerId, targetId, "Owner");
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
        chat.Members.Single(m => m.UserId == targetId).Role.Should().Be(ChatMemberRole.Member);
    }

    [Fact]
    public async Task Handle_DomainSetMemberRoleFails_PropagatesFailureWithoutSaving()
    {
        var adminId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(adminId, ChatMemberRole.Admin);
        chat.AddMember(targetId, ChatMemberRole.Member);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new SetChatMemberRoleCommand(Guid.NewGuid(), adminId, targetId, "Admin");
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
        await _uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ValidRequest_SetsRoleAndSaves()
    {
        var ownerId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(ownerId, ChatMemberRole.Owner);
        chat.AddMember(targetId, ChatMemberRole.Member);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new SetChatMemberRoleCommand(Guid.NewGuid(), ownerId, targetId, "admin");
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        chat.Members.Single(m => m.UserId == targetId).Role.Should().Be(ChatMemberRole.Admin);
        await _uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

namespace Messenger.Modules.Chats.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Application.Features.UpdateChat;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Results;
using NSubstitute;

public sealed class UpdateChatCommandHandlerTests
{
    private readonly IChatRepository _chatRepository = Substitute.For<IChatRepository>();
    private readonly IUnitOfWork     _uow            = Substitute.For<IUnitOfWork>();
    private readonly UpdateChatCommandHandler _sut;

    public UpdateChatCommandHandlerTests()
    {
        _sut = new UpdateChatCommandHandler(_chatRepository, _uow);
    }

    [Fact]
    public async Task Handle_ChatNotFound_ReturnsNotFound()
    {
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns((Chat?)null);

        var command = new UpdateChatCommand(Guid.NewGuid(), Guid.NewGuid(), "New Name", null, null);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Handle_DirectChat_ReturnsValidationFailure()
    {
        var chat = Chat.CreateDirect(Guid.NewGuid(), Guid.NewGuid());
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new UpdateChatCommand(Guid.NewGuid(), Guid.NewGuid(), "New Name", null, null);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
        await _uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_DomainUpdateInfoFails_PropagatesFailureWithoutSaving()
    {
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(Guid.NewGuid(), ChatMemberRole.Owner);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new UpdateChatCommand(Guid.NewGuid(), Guid.NewGuid(), "New Name", null, null);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
        await _uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ValidRequest_UpdatesChatAndSaves()
    {
        var ownerId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(ownerId, ChatMemberRole.Owner);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var command = new UpdateChatCommand(Guid.NewGuid(), ownerId, "New Name", "https://avatar.png", null);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        chat.Name.Should().Be("New Name");
        chat.AvatarUrl.Should().Be("https://avatar.png");
        await _uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

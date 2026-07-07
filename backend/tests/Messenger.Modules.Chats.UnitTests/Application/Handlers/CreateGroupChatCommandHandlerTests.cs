namespace Messenger.Modules.Chats.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Application.Features.CreateGroupChat;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Results;
using NSubstitute;

public sealed class CreateGroupChatCommandHandlerTests
{
    private readonly IChatRepository _chatRepository = Substitute.For<IChatRepository>();
    private readonly IUnitOfWork     _uow            = Substitute.For<IUnitOfWork>();
    private readonly CreateGroupChatCommandHandler _sut;

    public CreateGroupChatCommandHandlerTests()
    {
        _sut = new CreateGroupChatCommandHandler(_chatRepository, _uow);
    }

    [Fact]
    public async Task Handle_InvalidName_ReturnsValidationFailure()
    {
        var command = new CreateGroupChatCommand(Guid.NewGuid(), "", []);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
        _chatRepository.DidNotReceive().Add(Arg.Any<Chat>());
    }

    [Fact]
    public async Task Handle_ValidRequest_AddsCreatorAsOwner()
    {
        var creatorId = Guid.NewGuid();

        var command = new CreateGroupChatCommand(creatorId, "My Group", []);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        _chatRepository.Received(1).Add(Arg.Is<Chat>(c =>
            c.Members.Single(m => m.UserId == creatorId).Role == ChatMemberRole.Owner));
    }

    [Fact]
    public async Task Handle_ValidRequest_AddsOtherMembersAsPlainMembers()
    {
        var creatorId = Guid.NewGuid();
        var memberId1 = Guid.NewGuid();
        var memberId2 = Guid.NewGuid();

        var command = new CreateGroupChatCommand(creatorId, "My Group", [memberId1, memberId2]);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        _chatRepository.Received(1).Add(Arg.Is<Chat>(c =>
            c.Members.Count == 3 &&
            c.Members.Single(m => m.UserId == memberId1).Role == ChatMemberRole.Member &&
            c.Members.Single(m => m.UserId == memberId2).Role == ChatMemberRole.Member));
    }

    [Fact]
    public async Task Handle_CreatorIdIncludedInMemberIds_DoesNotAddDuplicateMembership()
    {
        var creatorId = Guid.NewGuid();

        var command = new CreateGroupChatCommand(creatorId, "My Group", [creatorId]);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        _chatRepository.Received(1).Add(Arg.Is<Chat>(c => c.Members.Count(m => m.UserId == creatorId) == 1));
    }

    [Fact]
    public async Task Handle_ValidRequest_SavesChanges()
    {
        var command = new CreateGroupChatCommand(Guid.NewGuid(), "My Group", []);
        await _sut.Handle(command, CancellationToken.None);

        await _uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

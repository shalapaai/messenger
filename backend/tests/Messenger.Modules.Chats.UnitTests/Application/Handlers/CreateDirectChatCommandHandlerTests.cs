namespace Messenger.Modules.Chats.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Application.Features.CreateDirectChat;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

public sealed class CreateDirectChatCommandHandlerTests
{
    private readonly IChatRepository _chatRepository = Substitute.For<IChatRepository>();
    private readonly IUnitOfWork     _uow            = Substitute.For<IUnitOfWork>();
    private readonly CreateDirectChatCommandHandler _sut;

    public CreateDirectChatCommandHandlerTests()
    {
        _sut = new CreateDirectChatCommandHandler(_chatRepository, _uow);
    }

    [Fact]
    public async Task Handle_CurrentUserSameAsOtherUser_ReturnsValidationFailure()
    {
        var userId = Guid.NewGuid();

        var command = new CreateDirectChatCommand(userId, userId);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public async Task Handle_ExistingDirectChat_ReturnsSuccessWithoutAddingNewChat()
    {
        var currentUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var existingChatId = Guid.NewGuid();
        _chatRepository.FindDirectChatIdAsync(currentUserId, otherUserId, Arg.Any<CancellationToken>())
                       .Returns(existingChatId);

        var command = new CreateDirectChatCommand(currentUserId, otherUserId);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(existingChatId);
        _chatRepository.DidNotReceive().Add(Arg.Any<Chat>());
        await _uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_NoExistingChat_CreatesChatWithBothMembersAndSaves()
    {
        var currentUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        _chatRepository.FindDirectChatIdAsync(currentUserId, otherUserId, Arg.Any<CancellationToken>())
                       .Returns((Guid?)null);

        var command = new CreateDirectChatCommand(currentUserId, otherUserId);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        _chatRepository.Received(1).Add(Arg.Is<Chat>(c =>
            c.Type == ChatType.Direct &&
            c.Members.Count == 2 &&
            c.Members.Any(m => m.UserId == currentUserId) &&
            c.Members.Any(m => m.UserId == otherUserId)));
        await _uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_SaveChangesThrowsDbUpdateExceptionAndChatNowExists_ReturnsExistingChat()
    {
        var currentUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var raceWinnerChatId = Guid.NewGuid();
        _chatRepository.FindDirectChatIdAsync(currentUserId, otherUserId, Arg.Any<CancellationToken>())
                       .Returns((Guid?)null, raceWinnerChatId);
        _uow.SaveChangesAsync(Arg.Any<CancellationToken>()).ThrowsAsync(new DbUpdateException());

        var command = new CreateDirectChatCommand(currentUserId, otherUserId);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(raceWinnerChatId);
        await _chatRepository.Received(2).FindDirectChatIdAsync(currentUserId, otherUserId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_SaveChangesThrowsDbUpdateExceptionAndChatStillMissing_Rethrows()
    {
        var currentUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        _chatRepository.FindDirectChatIdAsync(currentUserId, otherUserId, Arg.Any<CancellationToken>())
                       .Returns((Guid?)null);
        _uow.SaveChangesAsync(Arg.Any<CancellationToken>()).ThrowsAsync(new DbUpdateException());

        var command = new CreateDirectChatCommand(currentUserId, otherUserId);
        var act = async () => await _sut.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<DbUpdateException>();
    }
}

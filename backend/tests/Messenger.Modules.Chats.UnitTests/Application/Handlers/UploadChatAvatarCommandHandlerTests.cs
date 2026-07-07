namespace Messenger.Modules.Chats.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Application.Features.UploadChatAvatar;
using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Files.Application.Contracts;
using Messenger.Shared.Kernel.Results;
using NSubstitute;

public sealed class UploadChatAvatarCommandHandlerTests
{
    private readonly IChatRepository _chatRepository = Substitute.For<IChatRepository>();
    private readonly IFilesModule    _filesModule    = Substitute.For<IFilesModule>();
    private readonly IUnitOfWork     _uow            = Substitute.For<IUnitOfWork>();
    private readonly UploadChatAvatarCommandHandler _sut;

    public UploadChatAvatarCommandHandlerTests()
    {
        _sut = new UploadChatAvatarCommandHandler(_chatRepository, _filesModule, _uow);
    }

    private static UploadChatAvatarCommand CreateCommand(Guid requesterId) =>
        new(Guid.NewGuid(), requesterId, Stream.Null, "avatar.png", "image/png", 1024);

    [Fact]
    public async Task Handle_ChatNotFound_ReturnsNotFound()
    {
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns((Chat?)null);

        var result = await _sut.Handle(CreateCommand(Guid.NewGuid()), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Handle_DirectChat_ReturnsValidationFailure()
    {
        var chat = Chat.CreateDirect(Guid.NewGuid(), Guid.NewGuid());
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var result = await _sut.Handle(CreateCommand(Guid.NewGuid()), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public async Task Handle_RequesterNotAMember_ReturnsForbidden()
    {
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(Guid.NewGuid(), ChatMemberRole.Owner);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);

        var result = await _sut.Handle(CreateCommand(Guid.NewGuid()), CancellationToken.None);

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

        var result = await _sut.Handle(CreateCommand(requesterId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
        await _filesModule.DidNotReceive().UploadGroupAvatarAsync(
            Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<long>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(ChatMemberRole.Admin)]
    [InlineData(ChatMemberRole.Owner)]
    public async Task Handle_AdminOrOwner_UploadsAvatarUpdatesChatAndSaves(ChatMemberRole requesterRole)
    {
        var requesterId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(requesterId, requesterRole);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);
        _filesModule.UploadGroupAvatarAsync(
                Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<long>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Result.Success("https://files.example.com/avatar.png"));

        var result = await _sut.Handle(CreateCommand(requesterId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be("https://files.example.com/avatar.png");
        chat.AvatarUrl.Should().Be("https://files.example.com/avatar.png");
        await _uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_FilesModuleUploadFails_PropagatesFailureWithoutSaving()
    {
        var requesterId = Guid.NewGuid();
        var chat = Chat.CreateGroup("Group").Value!;
        chat.AddMember(requesterId, ChatMemberRole.Owner);
        _chatRepository.GetByIdAsync(Arg.Any<ChatId>(), Arg.Any<CancellationToken>()).Returns(chat);
        _filesModule.UploadGroupAvatarAsync(
                Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<long>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Result.Failure<string>(new Error("Files.Error", "upload failed")));

        var result = await _sut.Handle(CreateCommand(requesterId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Files.Error");
        await _uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

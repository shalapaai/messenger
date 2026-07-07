namespace Messenger.Modules.Messages.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Files.Application.Contracts;
using Messenger.Modules.Messages.Application;
using Messenger.Modules.Messages.Application.Features.UploadAndSendMessage;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;
using NSubstitute;

public sealed class UploadAndSendMessageCommandHandlerTests
{
    private readonly IFilesModule           _filesModule       = Substitute.For<IFilesModule>();
    private readonly IMessageRepository     _messageRepository = Substitute.For<IMessageRepository>();
    private readonly IChatMembershipChecker _membershipChecker = Substitute.For<IChatMembershipChecker>();
    private readonly IUnitOfWork            _unitOfWork        = Substitute.For<IUnitOfWork>();
    private readonly UploadAndSendMessageCommandHandler _sut;

    public UploadAndSendMessageCommandHandlerTests()
    {
        _sut = new UploadAndSendMessageCommandHandler(_filesModule, _messageRepository, _membershipChecker, _unitOfWork);
    }

    private static UploadedFile MakeFile(string name) =>
        new(new MemoryStream(), name, "image/png", 100);

    [Fact]
    public async Task Handle_WhenNotAMember_ReturnsForbidden()
    {
        var chatId = Guid.NewGuid();
        var senderId = Guid.NewGuid();
        var command = new UploadAndSendMessageCommand(chatId, senderId, [MakeFile("a.png")]);
        _membershipChecker.IsMemberAsync(chatId, senderId, Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
        await _filesModule.DidNotReceive().UploadChatAttachmentAsync(
            Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<long>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_UploadsFilesSequentially_OneCallPerFile()
    {
        var chatId = Guid.NewGuid();
        var senderId = Guid.NewGuid();
        var command = new UploadAndSendMessageCommand(chatId, senderId, [MakeFile("a.png"), MakeFile("b.png")]);
        _membershipChecker.IsMemberAsync(chatId, senderId, Arg.Any<CancellationToken>()).Returns(true);
        _filesModule.UploadChatAttachmentAsync(Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<long>(), senderId, chatId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new UploadedAttachmentInfo("key-a", "url-a")), Result.Success(new UploadedAttachmentInfo("key-b", "url-b")));

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _filesModule.Received(1).UploadChatAttachmentAsync(
            Arg.Any<Stream>(), "a.png", "image/png", 100, senderId, chatId, Arg.Any<CancellationToken>());
        await _filesModule.Received(1).UploadChatAttachmentAsync(
            Arg.Any<Stream>(), "b.png", "image/png", 100, senderId, chatId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenLaterUploadFails_CompensatingDeletesPreviouslyUploadedFilesAndPropagatesFailure()
    {
        var chatId = Guid.NewGuid();
        var senderId = Guid.NewGuid();
        var command = new UploadAndSendMessageCommand(chatId, senderId, [MakeFile("a.png"), MakeFile("b.png")]);
        _membershipChecker.IsMemberAsync(chatId, senderId, Arg.Any<CancellationToken>()).Returns(true);
        var uploadFailure = Error.Validation("File", "upload failed");
        _filesModule.UploadChatAttachmentAsync(Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<long>(), senderId, chatId, Arg.Any<CancellationToken>())
            .Returns(
                Result.Success(new UploadedAttachmentInfo("key-a", "url-a")),
                Result.Failure<UploadedAttachmentInfo>(uploadFailure));

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be(uploadFailure);
        await _filesModule.Received(1).DeleteChatAttachmentAsync("key-a", Arg.Any<CancellationToken>());
        _messageRepository.DidNotReceive().Add(Arg.Any<Message>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_OnFullSuccess_DoesNotCompensateAndSavesMessage()
    {
        var chatId = Guid.NewGuid();
        var senderId = Guid.NewGuid();
        var command = new UploadAndSendMessageCommand(chatId, senderId, [MakeFile("a.png")], "caption");
        _membershipChecker.IsMemberAsync(chatId, senderId, Arg.Any<CancellationToken>()).Returns(true);
        _filesModule.UploadChatAttachmentAsync(Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<long>(), senderId, chatId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new UploadedAttachmentInfo("key-a", "url-a")));

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Content.Should().Be("caption");
        result.Value!.Attachments.Should().ContainSingle(a => a.FileUrl == "url-a" && a.FileName == "a.png");
        await _filesModule.DidNotReceive().DeleteChatAttachmentAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        _messageRepository.Received(1).Add(Arg.Is<Message>(m => m.ChatId == chatId && m.SenderId == senderId));
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

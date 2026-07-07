namespace Messenger.Modules.Files.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Files.Application;
using Messenger.Modules.Files.Application.Abstractions;
using Messenger.Modules.Files.Application.Features.DeleteAvatar;
using Messenger.Modules.Files.Domain;
using NSubstitute;

public sealed class DeleteAvatarCommandHandlerTests
{
    private readonly IFileStorage    _fileStorage    = Substitute.For<IFileStorage>();
    private readonly IFileRepository _fileRepository = Substitute.For<IFileRepository>();
    private readonly IUnitOfWork     _unitOfWork     = Substitute.For<IUnitOfWork>();
    private readonly DeleteAvatarCommandHandler _sut;

    public DeleteAvatarCommandHandlerTests()
    {
        _sut = new DeleteAvatarCommandHandler(_fileStorage, _fileRepository, _unitOfWork);
    }

    [Fact]
    public async Task Handle_WithNoExistingAvatar_ReturnsSuccessWithoutSideEffects()
    {
        var userId = Guid.NewGuid();
        _fileRepository.GetAvatarByUserIdAsync(userId, Arg.Any<CancellationToken>()).Returns((FileUpload?)null);

        var result = await _sut.Handle(new DeleteAvatarCommand(userId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        _fileRepository.DidNotReceive().Remove(Arg.Any<FileUpload>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
        await _fileStorage.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithExistingAvatar_RemovesSavesThenDeletesInOrder()
    {
        var userId   = Guid.NewGuid();
        var existing = FileUpload.Create(userId, "avatar-key", "avatar.png", "image/png", 100, FileCategory.Avatar);
        _fileRepository.GetAvatarByUserIdAsync(userId, Arg.Any<CancellationToken>()).Returns(existing);

        var result = await _sut.Handle(new DeleteAvatarCommand(userId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        _fileRepository.Received(1).Remove(existing);
        Received.InOrder(() =>
        {
            _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>());
            _fileStorage.DeleteAsync(existing.FileKey, Arg.Any<CancellationToken>());
        });
    }
}

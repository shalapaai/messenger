namespace Messenger.Modules.Files.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Files.Application;
using Messenger.Modules.Files.Application.Abstractions;
using Messenger.Modules.Files.Application.Features.UploadAvatar;
using Messenger.Modules.Files.Domain;
using NSubstitute;

public sealed class UploadAvatarCommandHandlerTests
{
    private static readonly byte[] ValidPngBytes = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };

    private readonly IFileStorage    _fileStorage    = Substitute.For<IFileStorage>();
    private readonly IFileRepository _fileRepository = Substitute.For<IFileRepository>();
    private readonly IUnitOfWork     _unitOfWork     = Substitute.For<IUnitOfWork>();
    private readonly UploadAvatarCommandHandler _sut;

    public UploadAvatarCommandHandlerTests()
    {
        _sut = new UploadAvatarCommandHandler(_fileStorage, _fileRepository, _unitOfWork);
    }

    [Fact]
    public async Task Handle_WithNonImageContentType_ReturnsValidationError()
    {
        using var stream = new MemoryStream(ValidPngBytes);
        var command = new UploadAvatarCommand(Guid.NewGuid(), stream, "file.txt", "text/plain", ValidPngBytes.Length);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Contain("ContentType");
    }

    [Fact]
    public async Task Handle_WithSizeOverLimit_ReturnsValidationError()
    {
        using var stream = new MemoryStream(ValidPngBytes);
        const long overLimit = 5 * 1024 * 1024 + 1;
        var command = new UploadAvatarCommand(Guid.NewGuid(), stream, "avatar.png", "image/png", overLimit);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Contain("FileSize");
    }

    [Fact]
    public async Task Handle_WithMismatchedSignature_ReturnsValidationError()
    {
        var bogusBytes = new byte[] { 0x00, 0x00, 0x00, 0x00 };
        using var stream = new MemoryStream(bogusBytes);
        var command = new UploadAvatarCommand(Guid.NewGuid(), stream, "avatar.png", "image/png", bogusBytes.Length);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Contain("ContentType");
    }

    [Fact]
    public async Task Handle_WithValidAvatar_UploadsAndReturnsPublicUrl()
    {
        using var stream = new MemoryStream(ValidPngBytes);
        var userId = Guid.NewGuid();
        var command = new UploadAvatarCommand(userId, stream, "avatar.png", "image/png", ValidPngBytes.Length);
        _fileRepository.GetAvatarByUserIdAsync(userId, Arg.Any<CancellationToken>()).Returns((FileUpload?)null);
        _fileStorage.UploadAsync(stream, "avatar.png", "image/png", Arg.Any<CancellationToken>())
                    .Returns(new FileUploadResult("stored-key", "https://cdn/stored-key", ValidPngBytes.Length));

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be("https://cdn/stored-key");
        await _fileStorage.Received(1).UploadAsync(stream, "avatar.png", "image/png", Arg.Any<CancellationToken>());
        _fileRepository.Received(1).Add(Arg.Is<FileUpload>(f => f.FileKey == "stored-key" && f.UploadedBy == userId));
    }
}

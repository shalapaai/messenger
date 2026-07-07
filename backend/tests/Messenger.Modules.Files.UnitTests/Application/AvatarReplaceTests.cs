namespace Messenger.Modules.Files.UnitTests.Application;

using FluentAssertions;
using Messenger.Modules.Files.Application;
using Messenger.Modules.Files.Application.Abstractions;
using Messenger.Modules.Files.Domain;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

public sealed class AvatarReplaceTests
{
    private readonly IFileStorage    _fileStorage    = Substitute.For<IFileStorage>();
    private readonly IFileRepository _fileRepository = Substitute.For<IFileRepository>();
    private readonly IUnitOfWork     _unitOfWork     = Substitute.For<IUnitOfWork>();

    [Fact]
    public async Task CommitAsync_WithNoExisting_AddsAndSavesWithoutDeleting()
    {
        var newRecord = FileUpload.Create(Guid.NewGuid(), "new-key", "a.jpg", "image/jpeg", 100, FileCategory.Avatar);

        var result = await AvatarReplace.CommitAsync(
            _fileStorage, _fileRepository, _unitOfWork,
            existing: null, newRecord, "new-key", "https://cdn/new-key", "Avatar", CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be("https://cdn/new-key");
        _fileRepository.Received(1).Add(newRecord);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await _fileStorage.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CommitAsync_WithExisting_AddsRemovesSavesThenDeletesOldFile()
    {
        var existing  = FileUpload.Create(Guid.NewGuid(), "old-key", "old.jpg", "image/jpeg", 100, FileCategory.Avatar);
        var newRecord = FileUpload.Create(Guid.NewGuid(), "new-key", "a.jpg", "image/jpeg", 100, FileCategory.Avatar);

        var result = await AvatarReplace.CommitAsync(
            _fileStorage, _fileRepository, _unitOfWork,
            existing, newRecord, "new-key", "https://cdn/new-key", "Avatar", CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be("https://cdn/new-key");
        _fileRepository.Received(1).Add(newRecord);
        _fileRepository.Received(1).Remove(existing);
        Received.InOrder(() =>
        {
            _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>());
            _fileStorage.DeleteAsync(existing.FileKey, Arg.Any<CancellationToken>());
        });
    }

    [Fact]
    public async Task CommitAsync_WhenSaveChangesThrowsDbUpdateException_DeletesNewFileAndReturnsConflict()
    {
        var existing  = FileUpload.Create(Guid.NewGuid(), "old-key", "old.jpg", "image/jpeg", 100, FileCategory.Avatar);
        var newRecord = FileUpload.Create(Guid.NewGuid(), "new-key", "a.jpg", "image/jpeg", 100, FileCategory.Avatar);
        _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>()).ThrowsAsync(new DbUpdateException());

        var result = await AvatarReplace.CommitAsync(
            _fileStorage, _fileRepository, _unitOfWork,
            existing, newRecord, "new-key", "https://cdn/new-key", "Avatar", CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Contain("Avatar");
        result.Error.Description.Should().Contain("Avatar");
        await _fileStorage.Received(1).DeleteAsync("new-key", Arg.Any<CancellationToken>());
        await _fileStorage.DidNotReceive().DeleteAsync(existing.FileKey, Arg.Any<CancellationToken>());
    }
}

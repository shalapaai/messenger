namespace Messenger.Modules.Files.UnitTests.Domain;

using FluentAssertions;
using Messenger.Modules.Files.Domain;

public sealed class FileUploadTests
{
    [Fact]
    public void Create_AssignsNewGuidId()
    {
        var f1 = FileUpload.Create(Guid.NewGuid(), "key1", "a.jpg", "image/jpeg", 100, FileCategory.Avatar);
        var f2 = FileUpload.Create(Guid.NewGuid(), "key2", "b.jpg", "image/jpeg", 100, FileCategory.Avatar);

        f1.Id.Should().NotBe(f2.Id);
        f1.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_SetsAllFieldsFromArguments()
    {
        var uploadedBy = Guid.NewGuid();
        var chatId     = Guid.NewGuid();

        var file = FileUpload.Create(
            uploadedBy, "file-key", "original.png", "image/png", 12345, FileCategory.ChatAttachment, chatId);

        file.UploadedBy.Should().Be(uploadedBy);
        file.FileKey.Should().Be("file-key");
        file.OriginalName.Should().Be("original.png");
        file.ContentType.Should().Be("image/png");
        file.SizeBytes.Should().Be(12345);
        file.Category.Should().Be(FileCategory.ChatAttachment);
        file.ChatId.Should().Be(chatId);
    }

    [Fact]
    public void Create_SetsUploadedAtToUtcNow()
    {
        var before = DateTime.UtcNow;
        var file   = FileUpload.Create(Guid.NewGuid(), "key", "a.jpg", "image/jpeg", 100, FileCategory.Avatar);
        var after  = DateTime.UtcNow;

        file.UploadedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public void Create_WithoutChatId_DefaultsToNull()
    {
        var file = FileUpload.Create(Guid.NewGuid(), "key", "a.jpg", "image/jpeg", 100, FileCategory.Avatar);

        file.ChatId.Should().BeNull();
    }
}

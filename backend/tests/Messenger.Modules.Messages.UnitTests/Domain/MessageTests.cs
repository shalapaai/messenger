namespace Messenger.Modules.Messages.UnitTests.Domain;

using FluentAssertions;
using Messenger.Modules.Messages.Domain;
using Messenger.Modules.Messages.Domain.Events;
using Messenger.Shared.Kernel.Results;

public sealed class MessageTests
{
    private static readonly Guid ChatId = Guid.NewGuid();
    private static readonly Guid SenderId = Guid.NewGuid();

    #region Create

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null!)]
    public void Create_WithEmptyOrWhitespaceContent_ReturnsValidationFailure(string? content)
    {
        var result = Message.Create(ChatId, SenderId, content!);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public void Create_WithContentExceeding4096Chars_ReturnsValidationFailure()
    {
        var content = new string('a', 4097);

        var result = Message.Create(ChatId, SenderId, content);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public void Create_WithValidContent_TrimsContentSetsStatusSentAndSentAt()
    {
        var before = DateTime.UtcNow;

        var result = Message.Create(ChatId, SenderId, "  hello world  ");

        var after = DateTime.UtcNow;
        result.IsSuccess.Should().BeTrue();
        result.Value!.Content.Should().Be("hello world");
        result.Value!.Status.Should().Be(MessageStatus.Sent);
        result.Value!.SentAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public void Create_RaisesMessageSentDomainEvent_WithReplyToMessageId()
    {
        var replyToId = Guid.NewGuid();

        var result = Message.Create(ChatId, SenderId, "hello", replyToId);

        var message = result.Value!;
        message.DomainEvents.Should().ContainSingle();
        var domainEvent = message.DomainEvents.Single().Should().BeOfType<MessageSentDomainEvent>().Subject;
        domainEvent.MessageId.Should().Be(message.Id.Value);
        domainEvent.ChatId.Should().Be(ChatId);
        domainEvent.SenderId.Should().Be(SenderId);
        domainEvent.ReplyToMessageId.Should().Be(replyToId);
    }

    #endregion

    #region CreateWithAttachments

    [Fact]
    public void CreateWithAttachments_WithNoAttachments_ReturnsValidationFailure()
    {
        var result = Message.CreateWithAttachments(ChatId, SenderId, []);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public void CreateWithAttachments_WithMoreThanMaxAttachments_ReturnsValidationFailure()
    {
        var attachments = Enumerable.Range(0, Message.MaxAttachmentsPerMessage + 1)
            .Select(i => MessageAttachment.Create($"url{i}", $"file{i}.png", "image/png", 100, i))
            .ToList();

        var result = Message.CreateWithAttachments(ChatId, SenderId, attachments);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public void CreateWithAttachments_WithCaption_TrimsCaption()
    {
        var attachments = new List<MessageAttachment> { MessageAttachment.Create("url", "file.png", "image/png", 100, 0) };

        var result = Message.CreateWithAttachments(ChatId, SenderId, attachments, "  caption  ");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Content.Should().Be("caption");
    }

    [Fact]
    public void CreateWithAttachments_WithNullCaption_SetsEmptyContent()
    {
        var attachments = new List<MessageAttachment> { MessageAttachment.Create("url", "file.png", "image/png", 100, 0) };

        var result = Message.CreateWithAttachments(ChatId, SenderId, attachments);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Content.Should().BeEmpty();
    }

    [Fact]
    public void CreateWithAttachments_RaisesMessageSentDomainEvent_WithAttachments()
    {
        var attachments = new List<MessageAttachment> { MessageAttachment.Create("url", "file.png", "image/png", 100, 0) };

        var result = Message.CreateWithAttachments(ChatId, SenderId, attachments, "caption");

        var message = result.Value!;
        message.Attachments.Should().HaveCount(1);
        var domainEvent = message.DomainEvents.Single().Should().BeOfType<MessageSentDomainEvent>().Subject;
        domainEvent.Attachments.Should().HaveCount(1);
        domainEvent.Attachments[0].FileUrl.Should().Be("url");
    }

    #endregion

    #region CreateForwarded

    [Fact]
    public void CreateForwarded_WithEmptyContentAndNoAttachments_ReturnsValidationFailure()
    {
        var result = Message.CreateForwarded(ChatId, SenderId, "   ", [], Guid.NewGuid(), Guid.NewGuid());

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public void CreateForwarded_WithOnlyAttachmentsAndEmptyContent_Succeeds()
    {
        var attachments = new List<MessageAttachment> { MessageAttachment.Create("url", "file.png", "image/png", 100, 0) };

        var result = Message.CreateForwarded(ChatId, SenderId, "", attachments, Guid.NewGuid(), Guid.NewGuid());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Content.Should().BeEmpty();
        result.Value!.Attachments.Should().HaveCount(1);
    }

    [Fact]
    public void CreateForwarded_SetsForwardedFromFieldsAndSenderIsForwarder()
    {
        var originalMessageId = Guid.NewGuid();
        var originalSenderId = Guid.NewGuid();
        var forwarderId = Guid.NewGuid();

        var result = Message.CreateForwarded(ChatId, forwarderId, "hello", [], originalMessageId, originalSenderId);

        var message = result.Value!;
        message.ForwardedFromMessageId.Should().Be(originalMessageId);
        message.ForwardedFromUserId.Should().Be(originalSenderId);
        message.SenderId.Should().Be(forwarderId);
        message.SenderId.Should().NotBe(originalSenderId);
    }

    [Fact]
    public void CreateForwarded_ClonesAttachments_AsNewInstancesWithSameValues()
    {
        var original = MessageAttachment.Create("url", "file.png", "image/png", 100, 0);

        var result = Message.CreateForwarded(ChatId, SenderId, "", [original], Guid.NewGuid(), Guid.NewGuid());

        var cloned = result.Value!.Attachments.Single();
        cloned.Should().NotBeSameAs(original);
        cloned.Id.Should().NotBe(original.Id); // MessageAttachment.Create always mints a new Guid
        cloned.FileUrl.Should().Be(original.FileUrl);
        cloned.FileName.Should().Be(original.FileName);
        cloned.ContentType.Should().Be(original.ContentType);
        cloned.FileSizeBytes.Should().Be(original.FileSizeBytes);
        cloned.SortOrder.Should().Be(original.SortOrder);
    }

    [Fact]
    public void CreateForwarded_RaisesMessageSentDomainEvent()
    {
        var originalMessageId = Guid.NewGuid();
        var originalSenderId = Guid.NewGuid();

        var result = Message.CreateForwarded(ChatId, SenderId, "hello", [], originalMessageId, originalSenderId);

        var message = result.Value!;
        var domainEvent = message.DomainEvents.Single().Should().BeOfType<MessageSentDomainEvent>().Subject;
        domainEvent.ForwardedFromMessageId.Should().Be(originalMessageId);
        domainEvent.ForwardedFromUserId.Should().Be(originalSenderId);
    }

    #endregion

    #region Edit

    [Fact]
    public void Edit_ByNonSender_ReturnsForbidden()
    {
        var message = Message.Create(ChatId, SenderId, "hello").Value!;

        var result = message.Edit(Guid.NewGuid(), "new content");

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public void Edit_WhenAlreadyDeleted_ReturnsDeletedError()
    {
        var message = Message.Create(ChatId, SenderId, "hello").Value!;
        message.Delete();

        var result = message.Edit(SenderId, "new content");

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Message.Deleted");
    }

    [Fact]
    public void Edit_WithEmptyNewContent_ReturnsValidationFailure()
    {
        var message = Message.Create(ChatId, SenderId, "hello").Value!;

        var result = message.Edit(SenderId, "   ");

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public void Edit_WithValidContent_TrimsContentSetsEditedAtAndRaisesEvent()
    {
        var message = Message.Create(ChatId, SenderId, "hello").Value!;
        message.ClearDomainEvents();
        var before = DateTime.UtcNow;

        var result = message.Edit(SenderId, "  updated  ");

        var after = DateTime.UtcNow;
        result.IsSuccess.Should().BeTrue();
        message.Content.Should().Be("updated");
        message.EditedAt.Should().NotBeNull();
        message.EditedAt!.Value.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
        var domainEvent = message.DomainEvents.Single().Should().BeOfType<MessageEditedDomainEvent>().Subject;
        domainEvent.MessageId.Should().Be(message.Id.Value);
        domainEvent.ChatId.Should().Be(ChatId);
        domainEvent.NewContent.Should().Be("  updated  ");
    }

    #endregion

    #region Delete

    [Fact]
    public void Delete_WhenAlreadyDeleted_ReturnsAlreadyDeletedError()
    {
        var message = Message.Create(ChatId, SenderId, "hello").Value!;
        message.Delete();

        var result = message.Delete();

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Message.AlreadyDeleted");
    }

    [Fact]
    public void Delete_WhenNotDeleted_SetsStatusDeletedClearsContentAndRaisesEvent()
    {
        var message = Message.Create(ChatId, SenderId, "hello").Value!;
        message.ClearDomainEvents();
        var before = DateTime.UtcNow;

        var result = message.Delete();

        var after = DateTime.UtcNow;
        result.IsSuccess.Should().BeTrue();
        message.Status.Should().Be(MessageStatus.Deleted);
        message.Content.Should().BeEmpty();
        message.DeletedAt.Should().NotBeNull();
        message.DeletedAt!.Value.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
        var domainEvent = message.DomainEvents.Single().Should().BeOfType<MessageDeletedDomainEvent>().Subject;
        domainEvent.MessageId.Should().Be(message.Id.Value);
        domainEvent.ChatId.Should().Be(ChatId);
    }

    #endregion

    #region MarkAsDelivered / MarkAsRead

    [Fact]
    public void MarkAsDelivered_FromSent_TransitionsToDelivered()
    {
        var message = Message.Create(ChatId, SenderId, "hello").Value!;

        message.MarkAsDelivered();

        message.Status.Should().Be(MessageStatus.Delivered);
    }

    [Fact]
    public void MarkAsDelivered_FromRead_DoesNotDowngrade()
    {
        var message = Message.Create(ChatId, SenderId, "hello").Value!;
        message.MarkAsRead();

        message.MarkAsDelivered();

        message.Status.Should().Be(MessageStatus.Read);
    }

    [Fact]
    public void MarkAsDelivered_FromDeleted_DoesNotChange()
    {
        var message = Message.Create(ChatId, SenderId, "hello").Value!;
        message.Delete();

        message.MarkAsDelivered();

        message.Status.Should().Be(MessageStatus.Deleted);
    }

    [Fact]
    public void MarkAsRead_FromSent_TransitionsToRead()
    {
        var message = Message.Create(ChatId, SenderId, "hello").Value!;

        message.MarkAsRead();

        message.Status.Should().Be(MessageStatus.Read);
    }

    [Fact]
    public void MarkAsRead_FromDelivered_TransitionsToRead()
    {
        var message = Message.Create(ChatId, SenderId, "hello").Value!;
        message.MarkAsDelivered();

        message.MarkAsRead();

        message.Status.Should().Be(MessageStatus.Read);
    }

    [Fact]
    public void MarkAsRead_FromDeleted_DoesNotChange()
    {
        var message = Message.Create(ChatId, SenderId, "hello").Value!;
        message.Delete();

        message.MarkAsRead();

        message.Status.Should().Be(MessageStatus.Deleted);
    }

    #endregion
}

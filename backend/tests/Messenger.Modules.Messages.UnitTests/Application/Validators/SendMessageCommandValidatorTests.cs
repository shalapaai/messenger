namespace Messenger.Modules.Messages.UnitTests.Application.Validators;

using FluentAssertions;
using FluentValidation.TestHelper;
using Messenger.Modules.Messages.Application.Features.SendMessage;

public sealed class SendMessageCommandValidatorTests
{
    private readonly SendMessageCommandValidator _sut = new();

    [Fact]
    public void Validate_WithEmptyChatId_HasChatIdError()
    {
        var command = new SendMessageCommand(Guid.Empty, Guid.NewGuid(), "hello");

        var result = _sut.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.ChatId);
    }

    [Fact]
    public void Validate_WithEmptySenderId_HasSenderIdError()
    {
        var command = new SendMessageCommand(Guid.NewGuid(), Guid.Empty, "hello");

        var result = _sut.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SenderId);
    }

    [Fact]
    public void Validate_WithEmptyContent_HasContentErrorWithMessage()
    {
        var command = new SendMessageCommand(Guid.NewGuid(), Guid.NewGuid(), "");

        var result = _sut.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Content)
              .WithErrorMessage("Message content is required");
    }

    [Fact]
    public void Validate_WithContentExceeding4096Chars_HasContentErrorWithMaxLengthMessage()
    {
        var command = new SendMessageCommand(Guid.NewGuid(), Guid.NewGuid(), new string('a', 4097));

        var result = _sut.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Content)
              .WithErrorMessage("Message cannot exceed 4096 characters");
    }

    [Fact]
    public void Validate_WithValidCommand_HasNoErrors()
    {
        var command = new SendMessageCommand(Guid.NewGuid(), Guid.NewGuid(), "hello");

        var result = _sut.TestValidate(command);

        result.IsValid.Should().BeTrue();
    }
}

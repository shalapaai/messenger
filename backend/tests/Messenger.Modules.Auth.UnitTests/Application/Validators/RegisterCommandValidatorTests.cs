namespace Messenger.Modules.Auth.UnitTests.Application.Validators;

using FluentAssertions;
using FluentValidation.TestHelper;
using Messenger.Modules.Auth.Application.Features.Register;

public sealed class RegisterCommandValidatorTests
{
    private readonly RegisterCommandValidator _sut = new();

    [Fact]
    public void Validate_WithValidCommand_HasNoErrors()
    {
        var command = new RegisterCommand("user@example.com", "SecurePass1!", "Alice");

        var result = _sut.TestValidate(command);

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("missing@")]
    [InlineData("@nodomain.com")]
    public void Validate_WithInvalidEmail_HasEmailError(string email)
    {
        var command = new RegisterCommand(email, "SecurePass1!", "Alice");

        var result = _sut.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Validate_WithEmailExceeding255Chars_HasEmailError()
    {
        var longEmail = new string('a', 250) + "@x.com";
        var command = new RegisterCommand(longEmail, "SecurePass1!", "Alice");

        var result = _sut.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Theory]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("1234567")] // 7 символов — меньше минимума
    public void Validate_WithShortPassword_HasPasswordError(string password)
    {
        var command = new RegisterCommand("user@example.com", password, "Alice");

        var result = _sut.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Password)
              .WithErrorMessage("Password must be at least 8 characters");
    }

    [Fact]
    public void Validate_WithMinimumLengthPassword_IsValid()
    {
        var command = new RegisterCommand("user@example.com", "12345678", "Alice");

        var result = _sut.TestValidate(command);

        result.ShouldNotHaveValidationErrorFor(x => x.Password);
    }

    [Fact]
    public void Validate_WithPasswordExceeding128Chars_HasPasswordError()
    {
        var longPass = new string('a', 129);
        var command  = new RegisterCommand("user@example.com", longPass, "Alice");

        var result = _sut.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Fact]
    public void Validate_WithEmptyDisplayName_HasDisplayNameError()
    {
        var command = new RegisterCommand("user@example.com", "SecurePass1!", "");

        var result = _sut.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.DisplayName);
    }

    [Fact]
    public void Validate_WithDisplayNameExceeding100Chars_HasDisplayNameError()
    {
        var longName = new string('a', 101);
        var command  = new RegisterCommand("user@example.com", "SecurePass1!", longName);

        var result = _sut.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.DisplayName);
    }

    [Fact]
    public void Validate_MultipleErrors_AreAllReported()
    {
        var command = new RegisterCommand("", "sh", "");

        var result = _sut.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Email);
        result.ShouldHaveValidationErrorFor(x => x.Password);
        result.ShouldHaveValidationErrorFor(x => x.DisplayName);
    }
}

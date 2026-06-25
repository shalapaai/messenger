namespace Messenger.Modules.Auth.UnitTests.Application.Validators;

using FluentAssertions;
using FluentValidation.TestHelper;
using Messenger.Modules.Auth.Application.Features.Login;

public sealed class LoginCommandValidatorTests
{
    private readonly LoginCommandValidator _sut = new();

    [Fact]
    public void Validate_WithValidCredentials_HasNoErrors()
    {
        var command = new LoginCommand("user@example.com", "anypassword");

        var result = _sut.TestValidate(command);

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("@nodomain.com")]
    public void Validate_WithInvalidEmail_HasEmailError(string email)
    {
        var command = new LoginCommand(email, "anypassword");

        var result = _sut.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Validate_WithEmptyPassword_HasPasswordError()
    {
        var command = new LoginCommand("user@example.com", "");

        var result = _sut.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Fact]
    public void Validate_PasswordIsNotCheckedForLength()
    {
        // login не валидирует длину — только что не пустой
        var command = new LoginCommand("user@example.com", "x");

        var result = _sut.TestValidate(command);

        result.ShouldNotHaveValidationErrorFor(x => x.Password);
    }
}

namespace Messenger.Modules.Users.Application.Features.CreateUserProfile;

using FluentValidation;

public sealed class CreateUserProfileCommandValidator : AbstractValidator<CreateUserProfileCommand>
{
    public CreateUserProfileCommandValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Username is required")
            .Matches(@"^[a-zA-Z0-9_]{3,30}$")
            .WithMessage("Username must be 3–30 characters: letters, digits, or underscores");

        RuleFor(x => x.DisplayName)
            .NotEmpty().WithMessage("Display name is required")
            .MaximumLength(100).WithMessage("Display name must not exceed 100 characters");
    }
}

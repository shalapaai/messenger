namespace Messenger.Modules.Users.Application.Features.CreateUserProfile;

using FluentValidation;

public sealed class CreateUserProfileCommandValidator : AbstractValidator<CreateUserProfileCommand>
{
    public CreateUserProfileCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Email is not valid")
            .MaximumLength(255).WithMessage("Email must not exceed 255 characters");

        RuleFor(x => x.DisplayName)
            .NotEmpty().WithMessage("Display name is required")
            .MaximumLength(100).WithMessage("Display name must not exceed 100 characters");

        When(x => x.Login is not null, () =>
            RuleFor(x => x.Login!)
                .Matches(@"^[a-zA-Z0-9_]{3,30}$")
                .WithMessage("Login must be 3–30 characters and contain only letters, digits, or underscores"));

        When(x => x.AvatarColor is not null, () =>
            RuleFor(x => x.AvatarColor!)
                .Matches(@"^#[0-9A-Fa-f]{6}$")
                .WithMessage("AvatarColor must be a valid hex color (#RRGGBB)"));
    }
}

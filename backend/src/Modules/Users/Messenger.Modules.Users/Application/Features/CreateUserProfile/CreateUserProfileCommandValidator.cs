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

        When(x => x.Status is not null, () =>
            RuleFor(x => x.Status!)
                .MaximumLength(200).WithMessage("Status must not exceed 200 characters"));

        When(x => x.Phone is not null && x.Phone.Length > 0, () =>
            RuleFor(x => x.Phone!)
                .MaximumLength(20).WithMessage("Phone must not exceed 20 characters"));

        When(x => x.City is not null && x.City.Length > 0, () =>
            RuleFor(x => x.City!)
                .MaximumLength(100).WithMessage("City must not exceed 100 characters"));

        When(x => x.Department is not null && x.Department.Length > 0, () =>
            RuleFor(x => x.Department!)
                .MaximumLength(100).WithMessage("Department must not exceed 100 characters"));
    }
}

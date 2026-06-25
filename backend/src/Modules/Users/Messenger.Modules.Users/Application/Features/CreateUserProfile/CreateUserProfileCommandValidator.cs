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
    }
}

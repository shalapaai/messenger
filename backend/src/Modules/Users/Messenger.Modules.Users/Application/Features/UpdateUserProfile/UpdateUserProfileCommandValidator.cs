namespace Messenger.Modules.Users.Application.Features.UpdateUserProfile;

using FluentValidation;

public sealed class UpdateUserProfileCommandValidator : AbstractValidator<UpdateUserProfileCommand>
{
    public UpdateUserProfileCommandValidator()
    {
        When(x => x.DisplayName is not null, () =>
            RuleFor(x => x.DisplayName!)
                .NotEmpty().WithMessage("Display name must not be empty")
                .MaximumLength(100).WithMessage("Display name must not exceed 100 characters"));

        When(x => x.Status is not null, () =>
            RuleFor(x => x.Status!)
                .MaximumLength(200).WithMessage("Status must not exceed 200 characters"));
    }
}

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

        When(x => x.Login is not null, () =>
            RuleFor(x => x.Login!)
                .Matches(@"^[a-zA-Z0-9_]{3,30}$")
                .WithMessage("Login must be 3–30 characters and contain only letters, digits, or underscores"));

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

namespace Messenger.Modules.Auth.Application.Features.RefreshToken;

using FluentValidation;

public sealed class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
{
    public RefreshTokenCommandValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty().WithMessage("Refresh token is required");
    }
}

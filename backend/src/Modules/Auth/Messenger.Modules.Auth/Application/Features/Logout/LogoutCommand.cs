namespace Messenger.Modules.Auth.Application.Features.Logout;

using FluentValidation;
using Messenger.Shared.Kernel.Abstractions;

public sealed record LogoutCommand(string RefreshToken) : ICommand;

public sealed class LogoutCommandValidator : AbstractValidator<LogoutCommand>
{
    public LogoutCommandValidator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty().WithMessage("Refresh token is required");
    }
}

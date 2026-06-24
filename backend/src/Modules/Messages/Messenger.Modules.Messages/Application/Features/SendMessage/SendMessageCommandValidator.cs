namespace Messenger.Modules.Messages.Application.Features.SendMessage;

using FluentValidation;

public sealed class SendMessageCommandValidator : AbstractValidator<SendMessageCommand>
{
    public SendMessageCommandValidator()
    {
        RuleFor(x => x.ChatId).NotEmpty();
        RuleFor(x => x.SenderId).NotEmpty();
        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("Message content is required")
            .MaximumLength(4096).WithMessage("Message cannot exceed 4096 characters");
    }
}

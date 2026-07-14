namespace Messenger.Modules.Messages.Application.Features.CreatePoll;

using FluentValidation;
using Messenger.Modules.Messages.Domain;

public sealed class CreatePollCommandValidator : AbstractValidator<CreatePollCommand>
{
    public CreatePollCommandValidator()
    {
        RuleFor(x => x.ChatId).NotEmpty();
        RuleFor(x => x.SenderId).NotEmpty();

        RuleFor(x => x.Question)
            .NotEmpty().WithMessage("Poll question is required")
            .MaximumLength(Message.MaxPollQuestionLength).WithMessage($"Poll question cannot exceed {Message.MaxPollQuestionLength} characters");

        RuleFor(x => x.Options)
            .Must(o => o.Count(v => !string.IsNullOrWhiteSpace(v)) >= Message.MinPollOptions)
            .WithMessage($"A poll needs at least {Message.MinPollOptions} options")
            .Must(o => o.Count <= Message.MaxPollOptions)
            .WithMessage($"A poll cannot have more than {Message.MaxPollOptions} options");

        RuleForEach(x => x.Options)
            .MaximumLength(Message.MaxPollOptionLength).WithMessage($"Poll option cannot exceed {Message.MaxPollOptionLength} characters");
    }
}

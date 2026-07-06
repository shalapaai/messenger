namespace Messenger.Modules.Chats.Application.Features.CreateGroupChat;

using FluentValidation;

public sealed class CreateGroupChatCommandValidator : AbstractValidator<CreateGroupChatCommand>
{
    public CreateGroupChatCommandValidator()
    {
        When(x => x.AvatarColor is not null, () =>
            RuleFor(x => x.AvatarColor!)
                .Matches(@"^#[0-9A-Fa-f]{6}$")
                .WithMessage("AvatarColor must be a valid hex color (#RRGGBB)"));
    }
}

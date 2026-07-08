namespace Messenger.Modules.Chats.Application.Features.UpdateChat;

using FluentValidation;

public sealed class UpdateChatCommandValidator : AbstractValidator<UpdateChatCommand>
{
    public UpdateChatCommandValidator()
    {
        When(x => x.AvatarColor is not null, () =>
            RuleFor(x => x.AvatarColor!)
                .Matches(@"^#[0-9A-Fa-f]{6}$")
                .WithMessage("AvatarColor must be a valid hex color (#RRGGBB)"));

        When(x => !string.IsNullOrEmpty(x.AvatarUrl), () =>
            RuleFor(x => x.AvatarUrl!)
                .Must(url => url.StartsWith("/api/files/", StringComparison.Ordinal))
                .WithMessage("AvatarUrl must reference a file uploaded via the Files module"));
    }
}

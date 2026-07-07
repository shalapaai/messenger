namespace Messenger.Modules.Messages.Application.Features.SetMessageReaction;

using Messenger.Shared.Kernel.Abstractions;

public sealed record SetMessageReactionCommand(
    Guid ChatId,
    Guid MessageId,
    Guid RequesterId,
    string? Emoji) : ICommand;

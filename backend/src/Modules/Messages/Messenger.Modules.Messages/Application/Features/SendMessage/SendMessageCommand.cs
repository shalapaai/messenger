namespace Messenger.Modules.Messages.Application.Features.SendMessage;

using Messenger.Shared.Kernel.Abstractions;

public sealed record SendMessageCommand(
    Guid ChatId,
    Guid SenderId,
    string Content,
    Guid? ReplyToMessageId = null) : ICommand<Guid>;

namespace Messenger.Modules.Messages.Application.Features.DeleteMessages;

using Messenger.Shared.Kernel.Abstractions;

public sealed record DeleteMessagesCommand(
    Guid       ChatId,
    List<Guid> MessageIds,
    Guid       RequesterId) : ICommand<List<Guid>>;

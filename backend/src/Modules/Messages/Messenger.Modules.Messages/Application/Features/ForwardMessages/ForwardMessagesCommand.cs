namespace Messenger.Modules.Messages.Application.Features.ForwardMessages;

using Messenger.Shared.Kernel.Abstractions;

public sealed record ForwardMessagesCommand(
    List<Guid> MessageIds,
    Guid       SourceChatId,
    Guid       TargetChatId,
    Guid       RequesterId) : ICommand<List<Guid>>;

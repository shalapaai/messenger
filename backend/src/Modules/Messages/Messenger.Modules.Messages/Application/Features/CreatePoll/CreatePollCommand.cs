namespace Messenger.Modules.Messages.Application.Features.CreatePoll;

using Messenger.Shared.Kernel.Abstractions;

public sealed record CreatePollCommand(
    Guid         ChatId,
    Guid         SenderId,
    string       Question,
    List<string> Options) : ICommand<Guid>;

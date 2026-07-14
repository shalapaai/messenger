namespace Messenger.Modules.Messages.Application.Features.SetPollVote;

using Messenger.Shared.Kernel.Abstractions;

public sealed record SetPollVoteCommand(
    Guid  ChatId,
    Guid  MessageId,
    Guid  RequesterId,
    Guid? OptionId) : ICommand;

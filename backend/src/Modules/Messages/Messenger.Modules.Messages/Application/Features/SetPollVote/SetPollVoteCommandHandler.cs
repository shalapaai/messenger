namespace Messenger.Modules.Messages.Application.Features.SetPollVote;

using Messenger.Modules.Messages.Application;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;

public sealed class SetPollVoteCommandHandler(
    IMessageRepository     messageRepository,
    IChatMembershipChecker membershipChecker,
    IUnitOfWork            unitOfWork)
    : ICommandHandler<SetPollVoteCommand>
{
    public async Task<Result> Handle(SetPollVoteCommand command, CancellationToken ct)
    {
        var message = await messageRepository.GetByIdAsync(MessageId.From(command.MessageId), ct);

        if (message is null || message.ChatId != command.ChatId)
            return Result.Failure(Error.NotFound("Message"));

        if (!await membershipChecker.IsMemberAsync(message.ChatId, command.RequesterId, ct))
            return Result.Failure(Error.Forbidden("You are not a member of this chat"));

        var result = message.SetPollVote(command.RequesterId, command.OptionId);
        if (result.IsFailure)
            return result;

        messageRepository.Update(message);

        return await ConcurrencySafe.SaveChangesAsync(unitOfWork, "Message", ct);
    }
}

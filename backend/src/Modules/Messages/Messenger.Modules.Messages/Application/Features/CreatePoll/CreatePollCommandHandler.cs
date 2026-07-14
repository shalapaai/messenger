namespace Messenger.Modules.Messages.Application.Features.CreatePoll;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;

public sealed class CreatePollCommandHandler(
    IMessageRepository     messageRepository,
    IChatMembershipChecker membershipChecker,
    IUnitOfWork            unitOfWork)
    : ICommandHandler<CreatePollCommand, Guid>
{
    public async Task<Result<Guid>> Handle(CreatePollCommand command, CancellationToken ct)
    {
        if (!await membershipChecker.IsMemberAsync(command.ChatId, command.SenderId, ct))
            return Result.Failure<Guid>(Error.Forbidden("You are not a member of this chat"));

        // Опросы — только в группах: в личном чате голосование "кто за что" не имеет смысла
        // (собеседник и так виден без опроса), да и UI сознательно скрывает создание опроса там же.
        if (!await membershipChecker.IsGroupChatAsync(command.ChatId, ct))
            return Result.Failure<Guid>(Error.Forbidden("Polls can only be created in group chats"));

        var result = Message.CreatePoll(command.ChatId, command.SenderId, command.Question, command.Options);

        if (result.IsFailure)
            return Result.Failure<Guid>(result.Error);

        var message = result.Value!;
        messageRepository.Add(message);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(message.Id.Value);
    }
}

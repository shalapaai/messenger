namespace Messenger.Modules.Messages.Application.Features.EditMessage;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;

public sealed class EditMessageCommandHandler(
    IMessageRepository      messageRepository,
    IChatMembershipChecker  membershipChecker,
    IUnitOfWork             unitOfWork)
    : ICommandHandler<EditMessageCommand>
{
    public async Task<Result> Handle(EditMessageCommand command, CancellationToken ct)
    {
        var message = await messageRepository.GetByIdAsync(MessageId.From(command.MessageId), ct);

        if (message is null)
            return Result.Failure(Error.NotFound("Message"));

        // Отдельно от проверки авторства в Message.Edit(): если автора с тех пор исключили
        // из группового чата, редактировать сообщение в нём он больше не должен
        if (!await membershipChecker.IsMemberAsync(message.ChatId, command.RequesterId, ct))
            return Result.Failure(Error.Forbidden("You are not a member of this chat"));

        var result = message.Edit(command.RequesterId, command.NewContent);

        if (result.IsFailure)
            return result;

        messageRepository.Update(message);

        return await ConcurrencySafe.SaveChangesAsync(unitOfWork, "Message", ct);
    }
}

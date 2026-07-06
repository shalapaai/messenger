namespace Messenger.Modules.Messages.Application.Features.DeleteMessage;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

public sealed class DeleteMessageCommandHandler(
    IMessageRepository      messageRepository,
    IChatMembershipChecker  membershipChecker,
    IUnitOfWork             unitOfWork)
    : ICommandHandler<DeleteMessageCommand>
{
    public async Task<Result> Handle(DeleteMessageCommand command, CancellationToken ct)
    {
        var message = await messageRepository.GetByIdAsync(MessageId.From(command.MessageId), ct);

        if (message is null)
            return Result.Failure(Error.NotFound("Message"));

        // удалить может любой участник чата, не только автор сообщения
        if (!await membershipChecker.IsMemberAsync(message.ChatId, command.RequesterId, ct))
            return Result.Failure(Error.Forbidden("You are not a member of this chat"));

        var result = message.Delete();

        if (result.IsFailure)
            return result;

        messageRepository.Update(message);

        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Сообщение уже было изменено/удалено параллельно между чтением и записью.
            return Result.Failure(Error.Conflict("Message"));
        }

        return Result.Success();
    }
}

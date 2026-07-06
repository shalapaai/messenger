namespace Messenger.Modules.Messages.Application.Features.DeleteMessages;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

public sealed class DeleteMessagesCommandHandler(
    IMessageRepository      messageRepository,
    IChatMembershipChecker  membershipChecker,
    IUnitOfWork             unitOfWork)
    : ICommandHandler<DeleteMessagesCommand, List<Guid>>
{
    public async Task<Result<List<Guid>>> Handle(DeleteMessagesCommand command, CancellationToken ct)
    {
        if (command.MessageIds.Count == 0)
            return Result.Failure<List<Guid>>(Error.Validation("MessageIds", "Select at least one message"));

        if (!await membershipChecker.IsMemberAsync(command.ChatId, command.RequesterId, ct))
            return Result.Failure<List<Guid>>(Error.Forbidden("You are not a member of this chat"));

        var ids = command.MessageIds.Select(MessageId.From).ToList();
        var messages = await messageRepository.GetByIdsAsync(ids, ct);

        var deleted = new List<Guid>();
        foreach (var message in messages.Where(m => m.ChatId == command.ChatId))
        {
            var result = message.Delete();
            if (result.IsFailure) continue; // уже удалено — пропускаем, не роняем всю пачку

            messageRepository.Update(message);
            deleted.Add(message.Id.Value);
        }

        if (deleted.Count == 0)
            return Result.Failure<List<Guid>>(Error.NotFound("Message"));

        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Один из выбранных для удаления сообщений успели параллельно изменить/удалить.
            return Result.Failure<List<Guid>>(Error.Conflict("Message"));
        }

        return Result.Success(deleted);
    }
}

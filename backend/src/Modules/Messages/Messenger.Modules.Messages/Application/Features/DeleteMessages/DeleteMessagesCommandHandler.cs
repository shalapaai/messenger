namespace Messenger.Modules.Messages.Application.Features.DeleteMessages;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;

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

        // NotFound только если ни один id не относится к этому чату; уже удалённое сообщение —
        // не ошибка, повторный bulk-delete тех же id должен оставаться идемпотентным.
        var messagesInChat = messages.Where(m => m.ChatId == command.ChatId).ToList();
        if (messagesInChat.Count == 0)
            return Result.Failure<List<Guid>>(Error.NotFound("Message"));

        var deleted = new List<Guid>();
        foreach (var message in messagesInChat)
        {
            var result = message.Delete();
            if (result.IsFailure) continue; // уже удалено — пропускаем, не роняем всю пачку

            messageRepository.Update(message);
            deleted.Add(message.Id.Value);
        }

        if (deleted.Count == 0)
            return Result.Success(deleted);

        var saveResult = await ConcurrencySafe.SaveChangesAsync(unitOfWork, "Message", ct);
        return saveResult.IsFailure ? Result.Failure<List<Guid>>(saveResult.Error) : Result.Success(deleted);
    }
}

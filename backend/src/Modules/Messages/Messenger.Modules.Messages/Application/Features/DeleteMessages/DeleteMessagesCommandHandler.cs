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

        // NotFound — только если ни один из переданных id вообще не относится к этому чату
        // (невалидный/чужой id). Если id относится к чату, но сообщение уже удалено — это не
        // ошибка запроса: результат, которого хотел клиент (сообщения нет), уже достигнут,
        // так что повторный bulk-delete по тем же id должен быть идемпотентным no-op, а не 404.
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

        if (deleted.Count > 0)
            await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(deleted);
    }
}

namespace Messenger.Modules.Messages.Application.Features.ForwardMessages;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;

public sealed class ForwardMessagesCommandHandler(
    IMessageRepository      messageRepository,
    IChatMembershipChecker  membershipChecker,
    IUnitOfWork             unitOfWork)
    : ICommandHandler<ForwardMessagesCommand, List<Guid>>
{
    public async Task<Result<List<Guid>>> Handle(ForwardMessagesCommand command, CancellationToken ct)
    {
        if (command.MessageIds.Count == 0)
            return Result.Failure<List<Guid>>(Error.Validation("MessageIds", "Select at least one message"));

        if (!await membershipChecker.IsMemberAsync(command.SourceChatId, command.RequesterId, ct))
            return Result.Failure<List<Guid>>(Error.Forbidden("You are not a member of the source chat"));

        if (!await membershipChecker.IsMemberAsync(command.TargetChatId, command.RequesterId, ct))
            return Result.Failure<List<Guid>>(Error.Forbidden("You are not a member of the target chat"));

        var ids = command.MessageIds.Select(MessageId.From).ToList();
        var originals = await messageRepository.GetByIdsAsync(ids, ct);
        var originalsById = originals.ToDictionary(m => m.Id.Value);

        // сохраняем хронологический порядок сообщений в исходном чате, а не порядок id в запросе
        var ordered = command.MessageIds
            .Where(id => originalsById.ContainsKey(id))
            .Select(id => originalsById[id])
            .Where(m => m.ChatId == command.SourceChatId && m.Status != MessageStatus.Deleted)
            .OrderBy(m => m.SentAt)
            .ToList();

        if (ordered.Count == 0)
            return Result.Failure<List<Guid>>(Error.NotFound("Message"));

        var forwarded = new List<Message>();
        foreach (var original in ordered)
        {
            var result = Message.CreateForwarded(
                command.TargetChatId, command.RequesterId, original.Content, original.Id.Value, original.SenderId);

            // пустой контент (например, файл без подписи) — пропускаем эту копию, не роняем всю пачку
            if (result.IsSuccess)
                forwarded.Add(result.Value!);
        }

        if (forwarded.Count == 0)
            return Result.Failure<List<Guid>>(Error.Validation("MessageIds", "Nothing to forward"));

        foreach (var message in forwarded)
            messageRepository.Add(message);

        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(forwarded.Select(m => m.Id.Value).ToList());
    }
}

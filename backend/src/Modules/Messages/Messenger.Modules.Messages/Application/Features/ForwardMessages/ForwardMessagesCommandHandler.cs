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

        // Task.WhenAll здесь было бы некорректно: оба вызова идут через один и тот же scoped
        // DbContext, а EF Core не поддерживает параллельные операции на одном инстансе —
        // падает с "A second operation was started on this context instance..." на каждый форвард
        if (!await membershipChecker.IsMemberAsync(command.SourceChatId, command.RequesterId, ct))
            return Result.Failure<List<Guid>>(Error.Forbidden("You are not a member of the source chat"));

        if (!await membershipChecker.IsMemberAsync(command.TargetChatId, command.RequesterId, ct))
            return Result.Failure<List<Guid>>(Error.Forbidden("You are not a member of the target chat"));

        var ids = command.MessageIds.Select(MessageId.From).ToList();
        var originals = await messageRepository.GetByIdsAsync(ids, ct);

        // хронологический порядок в исходном чате, а не порядок id в запросе
        var ordered = originals
            .Where(m => m.ChatId == command.SourceChatId && m.Status != MessageStatus.Deleted)
            .OrderBy(m => m.SentAt)
            .ToList();

        if (ordered.Count == 0)
            return Result.Failure<List<Guid>>(Error.NotFound("Message"));

        var forwarded = new List<Message>();
        foreach (var original in ordered)
        {
            // если пересылают уже пересланное сообщение — показываем оригинального автора, а не форвардера
            var originalAuthorId = original.ForwardedFromUserId ?? original.SenderId;
            var result = Message.CreateForwarded(
                command.TargetChatId, command.RequesterId, original.Content, original.FileUrl, original.Id.Value, originalAuthorId);

            // пустой контент без вложения — пропускаем эту копию, не роняем всю пачку
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

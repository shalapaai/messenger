namespace Messenger.Modules.Messages.Application.Features.SendMessage;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;

public sealed class SendMessageCommandHandler(
    IMessageRepository      messageRepository,
    IChatMembershipChecker  membershipChecker,
    IUnitOfWork             unitOfWork)
    : ICommandHandler<SendMessageCommand, Guid>
{
    public async Task<Result<Guid>> Handle(SendMessageCommand command, CancellationToken ct)
    {
        if (!await membershipChecker.IsMemberAsync(command.ChatId, command.SenderId, ct))
            return Result.Failure<Guid>(Error.Forbidden("You are not a member of this chat"));

        // цитируемое сообщение обязано быть из того же чата — иначе клиент мог бы подставить id
        // сообщения из чужого чата и получить в ответ его текст/автора через resolved reply-превью
        if (command.ReplyToMessageId is { } replyId)
        {
            var replyTarget = await messageRepository.GetByIdAsync(MessageId.From(replyId), ct);
            if (replyTarget is null || replyTarget.ChatId != command.ChatId)
                return Result.Failure<Guid>(Error.Validation("ReplyToMessageId", "Message is not from this chat"));
        }

        var result = Message.Create(command.ChatId, command.SenderId, command.Content, command.ReplyToMessageId);

        if (result.IsFailure)
            return Result.Failure<Guid>(result.Error);

        var message = result.Value!;
        messageRepository.Add(message);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(message.Id.Value);
    }
}

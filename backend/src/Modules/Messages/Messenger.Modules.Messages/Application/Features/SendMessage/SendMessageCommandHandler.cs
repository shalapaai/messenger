namespace Messenger.Modules.Messages.Application.Features.SendMessage;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class SendMessageCommandHandler(
    IMessageRepository messageRepository,
    IUnitOfWork unitOfWork)
    : ICommandHandler<SendMessageCommand, Guid>
{
    public async Task<Result<Guid>> Handle(SendMessageCommand command, CancellationToken ct)
    {
        var result = Message.Create(command.ChatId, command.SenderId, command.Content, command.ReplyToMessageId);

        if (result.IsFailure)
            return Result.Failure<Guid>(result.Error);

        var message = result.Value!;
        messageRepository.Add(message);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(message.Id.Value);
    }
}

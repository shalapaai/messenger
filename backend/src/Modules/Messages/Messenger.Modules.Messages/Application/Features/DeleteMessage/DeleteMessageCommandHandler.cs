namespace Messenger.Modules.Messages.Application.Features.DeleteMessage;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class DeleteMessageCommandHandler(
    IMessageRepository messageRepository,
    IUnitOfWork unitOfWork)
    : ICommandHandler<DeleteMessageCommand>
{
    public async Task<Result> Handle(DeleteMessageCommand command, CancellationToken ct)
    {
        var message = await messageRepository.GetByIdAsync(MessageId.From(command.MessageId), ct);

        if (message is null)
            return Result.Failure(Error.NotFound("Message"));

        var result = message.Delete(command.RequesterId);

        if (result.IsFailure)
            return result;

        messageRepository.Update(message);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }
}

namespace Messenger.Modules.Messages.Application.Features.EditMessage;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

public sealed class EditMessageCommandHandler(
    IMessageRepository messageRepository,
    IUnitOfWork unitOfWork)
    : ICommandHandler<EditMessageCommand>
{
    public async Task<Result> Handle(EditMessageCommand command, CancellationToken ct)
    {
        var message = await messageRepository.GetByIdAsync(MessageId.From(command.MessageId), ct);

        if (message is null)
            return Result.Failure(Error.NotFound("Message"));

        var result = message.Edit(command.RequesterId, command.NewContent);

        if (result.IsFailure)
            return result;

        messageRepository.Update(message);

        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Кто-то другой (или это же сообщение с другой вкладки) успел изменить/удалить
            // сообщение между чтением и записью — явный конфликт вместо тихого перезатирания.
            return Result.Failure(Error.Conflict("Message"));
        }

        return Result.Success();
    }
}

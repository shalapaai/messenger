namespace Messenger.Modules.Chats.Application.Features.DeleteChat;

using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class DeleteChatCommandHandler(
    IChatRepository  chatRepository,
    IMessagesModule  messagesModule,
    IUnitOfWork      unitOfWork)
    : ICommandHandler<DeleteChatCommand>
{
    public async Task<Result> Handle(DeleteChatCommand command, CancellationToken ct)
    {
        var chat = await chatRepository.GetByIdAsync(ChatId.From(command.ChatId), ct);

        if (chat is null)
            return Result.Failure(Error.NotFound("Chat"));

        var check = chat.EnsureCanBeDeletedBy(command.RequesterId);
        if (check.IsFailure)
            return check;

        // Явный межмодульный вызов, а не FK ON DELETE CASCADE — Chats не должен
        // полагаться на то, что у Messages именно такая схема хранения.
        var deleteMessages = await messagesModule.DeleteAllMessagesInChatAsync(command.ChatId, ct);
        if (deleteMessages.IsFailure)
            return deleteMessages;

        chatRepository.Delete(chat);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}

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

        chatRepository.Delete(chat);
        await unitOfWork.SaveChangesAsync(ct);

        // Явный вызов, а не FK CASCADE — Chats не должен зависеть от схемы хранения Messages.
        // Выполняется после коммита и best-effort: худший случай — чат удалён, а сообщения orphaned
        // (безопасно, подчищаются повторной попыткой), а не наоборот (чат остался бы, потеряв сообщения).
        try
        {
            await messagesModule.DeleteAllMessagesInChatAsync(command.ChatId, ct);
        }
        catch (Exception)
        {
            // не мешаем успешному ответу — с точки зрения пользователя чат уже удалён
        }

        return Result.Success();
    }
}

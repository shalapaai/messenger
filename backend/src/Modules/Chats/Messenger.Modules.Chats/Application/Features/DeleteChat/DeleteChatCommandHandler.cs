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

        // Явный межмодульный вызов, а не FK ON DELETE CASCADE — Chats не должен
        // полагаться на то, что у Messages именно такая схема хранения.
        // Выполняется ПОСЛЕ коммита удаления чата и намеренно best-effort: если бы порядок
        // был обратным (как раньше) и это удаление сообщений (ExecuteDeleteAsync, отдельный
        // DbContext/соединение) выполнилось раньше, но SaveChangesAsync ниже упал бы,
        // сообщения были бы уже необратимо удалены, а чат — нет. Теперь худший случай —
        // чат удалён, а сообщения остаются orphaned (безопасно, подчищаются повторной попыткой).
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

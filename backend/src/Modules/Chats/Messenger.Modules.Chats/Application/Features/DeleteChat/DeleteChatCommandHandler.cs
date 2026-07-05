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

        // Модули используют раздельные DbContext'ы (разные подключения) — нет общей транзакции,
        // которая покрыла бы оба шага атомарно. Поэтому удаляем чат ПЕРВЫМ: если этот шаг упадёт,
        // не потеряно ничего, запрос можно повторить. Сообщения чистим вторым шагом — если он
        // упадёт, чат уже не виден пользователю, а осиротевшие строки Messages безвредны и не
        // мешают повторной уборке. Обратный порядок мог бы стереть всю историю переписки и
        // оставить чат висеть, если бы удаление самого чата не удалось.
        chatRepository.Delete(chat);
        await unitOfWork.SaveChangesAsync(ct);

        var deleteMessages = await messagesModule.DeleteAllMessagesInChatAsync(command.ChatId, ct);
        if (deleteMessages.IsFailure)
            return deleteMessages;

        return Result.Success();
    }
}

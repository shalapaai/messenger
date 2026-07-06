namespace Messenger.Modules.Chats.Application.Features.RemoveChatMember;

using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class RemoveChatMemberCommandHandler(
    IChatRepository chatRepository,
    IMessagesModule messagesModule,
    IUnitOfWork     unitOfWork)
    : ICommandHandler<RemoveChatMemberCommand>
{
    public async Task<Result> Handle(RemoveChatMemberCommand command, CancellationToken ct)
    {
        var chat = await chatRepository.GetByIdAsync(ChatId.From(command.ChatId), ct);

        if (chat is null)
            return Result.Failure(Error.NotFound("Chat"));

        if (chat.Type != ChatType.Group)
            return Result.Failure(Error.Validation("ChatType", "Cannot remove members from a direct chat"));

        var result = chat.RemoveMember(command.RequesterId, command.UserId);
        if (result.IsFailure)
            return result;

        // Если это был последний участник (например, единственный Owner покинул группу) —
        // удаляем сам чат, иначе он навсегда остаётся в БД пустым и недоступным
        // (добавить участника нельзя — им нужно уже состоять в чате, удалить как Direct тоже нельзя).
        var chatDeleted = chat.IsEmpty;
        if (chatDeleted)
            chatRepository.Delete(chat);

        await unitOfWork.SaveChangesAsync(ct);

        // Чат целиком удалён — сообщения каскадно исчезнут вместе с ним, показывать
        // системное сообщение больше некому
        if (!chatDeleted)
        {
            var eventType = command.RequesterId == command.UserId
                ? SystemEventType.MemberLeft
                : SystemEventType.MemberRemoved;
            await messagesModule.CreateSystemMessageAsync(
                command.ChatId, command.RequesterId, command.UserId, eventType, ct);
        }

        return Result.Success();
    }
}

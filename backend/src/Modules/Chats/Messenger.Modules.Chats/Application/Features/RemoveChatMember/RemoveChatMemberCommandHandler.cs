namespace Messenger.Modules.Chats.Application.Features.RemoveChatMember;

using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class RemoveChatMemberCommandHandler(
    IChatRepository chatRepository,
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

        // Опустевшая группа навсегда остаётся в БД недоступной (добавить участника уже нельзя) — удаляем сразу.
        if (chat.IsEmpty)
            chatRepository.Delete(chat);

        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}

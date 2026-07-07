namespace Messenger.Modules.Chats.Application.Features.AddChatMember;

using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

public sealed class AddChatMemberCommandHandler(
    IChatRepository chatRepository,
    IMessagesModule messagesModule,
    IUnitOfWork     unitOfWork)
    : ICommandHandler<AddChatMemberCommand>
{
    public async Task<Result> Handle(AddChatMemberCommand command, CancellationToken ct)
    {
        var chat = await chatRepository.GetByIdAsync(ChatId.From(command.ChatId), ct);

        if (chat is null)
            return Result.Failure(Error.NotFound("Chat"));

        if (chat.Type != ChatType.Group)
            return Result.Failure(Error.Validation("ChatType", "Cannot add members to a direct chat"));

        var requester = chat.Members.FirstOrDefault(m => m.UserId == command.RequesterId);
        if (requester is null)
            return Result.Failure(Error.Forbidden("You are not a member of this chat"));

        if (requester.Role == ChatMemberRole.Member)
            return Result.Failure(Error.Forbidden("Only admins can add members"));

        if (chat.Members.Any(m => m.UserId == command.UserId))
            return Result.Failure(Error.Validation("UserId", "User is already a member of this chat"));

        chat.AddMember(command.UserId);
        chat.NotifyMembershipChanged();

        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // TOCTOU: два одновременных add-member на одного userId оба проходят проверку выше —
            // второй SaveChangesAsync падает на составном PK (chat_id, user_id). Превращаем в ту же
            // дружелюбную ошибку валидации, а не 500.
            return Result.Failure(Error.Validation("UserId", "User is already a member of this chat"));
        }

        await messagesModule.CreateSystemMessageAsync(
            command.ChatId, command.RequesterId, command.UserId, SystemEventType.MemberAdded, ct);

        return Result.Success();
    }
}

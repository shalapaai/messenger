namespace Messenger.Modules.Chats.Application.Features.AddChatMember;

using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class AddChatMemberCommandHandler(
    IChatRepository chatRepository,
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

        chat.AddMember(command.UserId);

        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}

namespace Messenger.Modules.Chats.Application.Features.SetChatMemberRole;

using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class SetChatMemberRoleCommandHandler(
    IChatRepository chatRepository,
    IUnitOfWork     unitOfWork)
    : ICommandHandler<SetChatMemberRoleCommand>
{
    public async Task<Result> Handle(SetChatMemberRoleCommand command, CancellationToken ct)
    {
        var chat = await chatRepository.GetByIdAsync(ChatId.From(command.ChatId), ct);

        if (chat is null)
            return Result.Failure(Error.NotFound("Chat"));

        if (chat.Type != ChatType.Group)
            return Result.Failure(Error.Validation("ChatType", "Cannot set roles in a direct chat"));

        if (!Enum.TryParse<ChatMemberRole>(command.Role, ignoreCase: true, out var newRole))
            return Result.Failure(Error.Validation("Role", $"Unknown role '{command.Role}'"));

        if (newRole == ChatMemberRole.Owner)
            return Result.Failure(Error.Validation("Role", "Cannot assign the Owner role"));

        var result = chat.SetMemberRole(command.RequesterId, command.UserId, newRole);
        if (result.IsFailure)
            return result;

        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}

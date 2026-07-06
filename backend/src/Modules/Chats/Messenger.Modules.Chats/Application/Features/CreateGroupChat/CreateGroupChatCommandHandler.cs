namespace Messenger.Modules.Chats.Application.Features.CreateGroupChat;

using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class CreateGroupChatCommandHandler(
    IChatRepository chatRepository,
    IUnitOfWork unitOfWork)
    : ICommandHandler<CreateGroupChatCommand, Guid>
{
    public async Task<Result<Guid>> Handle(CreateGroupChatCommand command, CancellationToken ct)
    {
        var result = Chat.CreateGroup(command.Name, command.AvatarColor);
        if (result.IsFailure)
            return Result.Failure<Guid>(result.Error);

        var chat = result.Value!;
        chat.AddMember(command.CreatorId, ChatMemberRole.Owner);

        foreach (var memberId in command.MemberIds.Where(id => id != command.CreatorId))
            chat.AddMember(memberId);

        chat.NotifyMembershipChanged();

        chatRepository.Add(chat);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(chat.Id.Value);
    }
}

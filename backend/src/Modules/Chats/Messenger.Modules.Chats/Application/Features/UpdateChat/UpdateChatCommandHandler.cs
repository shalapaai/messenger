namespace Messenger.Modules.Chats.Application.Features.UpdateChat;

using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class UpdateChatCommandHandler(
    IChatRepository chatRepository,
    IUnitOfWork     unitOfWork)
    : ICommandHandler<UpdateChatCommand>
{
    public async Task<Result> Handle(UpdateChatCommand command, CancellationToken ct)
    {
        var chat = await chatRepository.GetByIdAsync(ChatId.From(command.ChatId), ct);

        if (chat is null)
            return Result.Failure(Error.NotFound("Chat"));

        if (chat.Type != ChatType.Group)
            return Result.Failure(Error.Validation("ChatType", "Cannot update a direct chat"));

        var result = chat.UpdateInfo(command.RequesterId, command.Name, command.AvatarUrl, command.AvatarColor);
        if (result.IsFailure)
            return result;

        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}

namespace Messenger.Modules.Chats.Application.Features.RemoveChatAvatar;

using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Files.Application.Contracts;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class RemoveChatAvatarCommandHandler(
    IChatRepository chatRepository,
    IFilesModule    filesModule,
    IUnitOfWork     unitOfWork)
    : ICommandHandler<RemoveChatAvatarCommand>
{
    public async Task<Result> Handle(RemoveChatAvatarCommand command, CancellationToken ct)
    {
        var chat = await chatRepository.GetByIdAsync(ChatId.From(command.ChatId), ct);

        if (chat is null)
            return Result.Failure(Error.NotFound("Chat"));

        if (chat.Type != ChatType.Group)
            return Result.Failure(Error.Validation("ChatType", "Only group chats have an avatar"));

        var result = chat.ClearAvatar(command.RequesterId);
        if (result.IsFailure)
            return result;

        await filesModule.DeleteGroupAvatarAsync(command.ChatId, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}

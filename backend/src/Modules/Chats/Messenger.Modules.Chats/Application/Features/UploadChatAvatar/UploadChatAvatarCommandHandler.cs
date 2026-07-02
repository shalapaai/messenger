namespace Messenger.Modules.Chats.Application.Features.UploadChatAvatar;

using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Files.Application.Contracts;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class UploadChatAvatarCommandHandler(
    IChatRepository chatRepository,
    IFilesModule    filesModule,
    IUnitOfWork     unitOfWork)
    : ICommandHandler<UploadChatAvatarCommand, string>
{
    public async Task<Result<string>> Handle(UploadChatAvatarCommand command, CancellationToken ct)
    {
        var chat = await chatRepository.GetByIdAsync(ChatId.From(command.ChatId), ct);

        if (chat is null)
            return Result.Failure<string>(Error.NotFound("Chat"));

        if (chat.Type != ChatType.Group)
            return Result.Failure<string>(Error.Validation("ChatType", "Only group chats have an avatar"));

        var requester = chat.Members.FirstOrDefault(m => m.UserId == command.RequesterId);
        if (requester is null)
            return Result.Failure<string>(Error.Forbidden("You are not a member of this chat"));

        if (requester.Role == ChatMemberRole.Member)
            return Result.Failure<string>(Error.Forbidden("Only admins can update chat info"));

        var uploadResult = await filesModule.UploadGroupAvatarAsync(
            command.Content, command.FileName, command.ContentType, command.FileSizeBytes,
            command.RequesterId, command.ChatId, ct);
        if (uploadResult.IsFailure)
            return uploadResult;

        var updateResult = chat.UpdateInfo(command.RequesterId, null, uploadResult.Value);
        if (updateResult.IsFailure)
            return Result.Failure<string>(updateResult.Error);

        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(uploadResult.Value!);
    }
}

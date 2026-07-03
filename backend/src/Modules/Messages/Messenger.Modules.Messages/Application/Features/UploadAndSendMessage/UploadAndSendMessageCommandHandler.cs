namespace Messenger.Modules.Messages.Application.Features.UploadAndSendMessage;

using Messenger.Modules.Files.Application.Contracts;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;

public sealed class UploadAndSendMessageCommandHandler(
    IFilesModule           filesModule,
    IMessageRepository     messageRepository,
    IChatMembershipChecker membershipChecker,
    IUnitOfWork            unitOfWork)
    : ICommandHandler<UploadAndSendMessageCommand, UploadAndSendMessageResult>
{
    public async Task<Result<UploadAndSendMessageResult>> Handle(UploadAndSendMessageCommand command, CancellationToken ct)
    {
        if (!await membershipChecker.IsMemberAsync(command.ChatId, command.SenderId, ct))
            return Result.Failure<UploadAndSendMessageResult>(Error.Forbidden("You are not a member of this chat"));

        var uploadResult = await filesModule.UploadChatAttachmentAsync(
            command.FileContent, command.FileName, command.ContentType,
            command.FileSizeBytes, command.SenderId, command.ChatId, ct);

        if (uploadResult.IsFailure)
            return Result.Failure<UploadAndSendMessageResult>(uploadResult.Error);

        var messageResult = Message.CreateFile(
            command.ChatId, command.SenderId, uploadResult.Value!,
            command.FileName, command.ContentType, command.FileSizeBytes, command.Caption);
        if (messageResult.IsFailure)
            return Result.Failure<UploadAndSendMessageResult>(messageResult.Error);

        var message = messageResult.Value!;
        messageRepository.Add(message);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(new UploadAndSendMessageResult(
            message.Id.Value, message.Content, uploadResult.Value!,
            command.FileName, command.ContentType, command.FileSizeBytes, message.SentAt));
    }
}

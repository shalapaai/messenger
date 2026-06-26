namespace Messenger.Modules.Messages.Application.Features.UploadAndSendMessage;

using Messenger.Modules.Files.Application.Contracts;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class UploadAndSendMessageCommandHandler(
    IFilesModule       filesModule,
    IMessageRepository messageRepository,
    IUnitOfWork        unitOfWork)
    : ICommandHandler<UploadAndSendMessageCommand, Guid>
{
    public async Task<Result<Guid>> Handle(UploadAndSendMessageCommand command, CancellationToken ct)
    {
        var uploadResult = await filesModule.UploadChatAttachmentAsync(
            command.FileContent, command.FileName, command.ContentType,
            command.FileSizeBytes, command.SenderId, ct);

        if (uploadResult.IsFailure)
            return Result.Failure<Guid>(uploadResult.Error);

        var messageResult = Message.CreateFile(command.ChatId, command.SenderId, uploadResult.Value!, command.Caption);
        if (messageResult.IsFailure)
            return Result.Failure<Guid>(messageResult.Error);

        messageRepository.Add(messageResult.Value!);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(messageResult.Value!.Id.Value);
    }
}

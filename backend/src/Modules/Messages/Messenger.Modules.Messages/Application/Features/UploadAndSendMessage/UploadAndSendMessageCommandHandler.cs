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

        // Последовательно, не параллельно: Files-модуль пишет через тот же scoped DbContext (см. ForwardMessages).
        var attachments = new List<MessageAttachment>();
        var uploadedKeys = new List<string>();
        var sortOrder = 0;

        // Если загрузка любого файла или сохранение сообщения провалится — подчищаем уже
        // загруженные файлы, иначе они остаются в хранилище/БД никем не удаляемым мусором.
        try
        {
            foreach (var file in command.Files)
            {
                var uploadResult = await filesModule.UploadChatAttachmentAsync(
                    file.Content, file.FileName, file.ContentType, file.FileSizeBytes, command.SenderId, command.ChatId, ct);

                if (uploadResult.IsFailure)
                    return Result.Failure<UploadAndSendMessageResult>(uploadResult.Error);

                uploadedKeys.Add(uploadResult.Value!.FileKey);
                attachments.Add(MessageAttachment.Create(
                    uploadResult.Value!.PublicUrl, file.FileName, file.ContentType, file.FileSizeBytes, sortOrder++));
            }

            var messageResult = Message.CreateWithAttachments(command.ChatId, command.SenderId, attachments, command.Caption);
            if (messageResult.IsFailure)
                return Result.Failure<UploadAndSendMessageResult>(messageResult.Error);

            var message = messageResult.Value!;
            messageRepository.Add(message);
            await unitOfWork.SaveChangesAsync(ct);

            uploadedKeys.Clear(); // всё сохранилось успешно — подчищать нечего
            return Result.Success(new UploadAndSendMessageResult(
                message.Id.Value, message.Content,
                attachments.Select(a => new AttachmentResult(a.FileUrl, a.FileName, a.ContentType, a.FileSizeBytes)).ToList(),
                message.SentAt));
        }
        finally
        {
            foreach (var key in uploadedKeys)
                await filesModule.DeleteChatAttachmentAsync(key, ct);
        }
    }
}

namespace Messenger.Modules.Files.Application.Contracts;

using Messenger.Shared.Kernel.Results;

public interface IFilesModule
{
    Task<Result<string>> UploadChatAttachmentAsync(
        Stream      content,
        string      fileName,
        string      contentType,
        long        fileSizeBytes,
        Guid        uploadedBy,
        Guid        chatId,
        CancellationToken ct = default);
}

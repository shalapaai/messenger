namespace Messenger.Modules.Files.Application.Contracts;

using Messenger.Shared.Kernel.Results;

public sealed record UploadedAttachmentInfo(string FileKey, string PublicUrl);

public interface IFilesModule
{
    Task<Result<UploadedAttachmentInfo>> UploadChatAttachmentAsync(
        Stream      content,
        string      fileName,
        string      contentType,
        long        fileSizeBytes,
        Guid        uploadedBy,
        Guid        chatId,
        CancellationToken ct = default);

    Task<Result<string>> UploadGroupAvatarAsync(
        Stream      content,
        string      fileName,
        string      contentType,
        long        fileSizeBytes,
        Guid        uploadedBy,
        Guid        chatId,
        CancellationToken ct = default);

    Task DeleteChatAttachmentAsync(string fileKey, CancellationToken ct = default);

    Task DeleteGroupAvatarAsync(Guid chatId, CancellationToken ct = default);
}

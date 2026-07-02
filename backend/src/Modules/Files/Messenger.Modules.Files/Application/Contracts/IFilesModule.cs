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

    /// <summary>Загружает аватарку группового чата, удаляя предыдущую (дедуп по chatId, не по uploadedBy —
    /// иначе загрузка админом аватарки группы затирала бы его личный аватар).</summary>
    Task<Result<string>> UploadGroupAvatarAsync(
        Stream      content,
        string      fileName,
        string      contentType,
        long        fileSizeBytes,
        Guid        uploadedBy,
        Guid        chatId,
        CancellationToken ct = default);
}

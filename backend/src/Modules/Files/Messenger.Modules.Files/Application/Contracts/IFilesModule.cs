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

    /// <summary>Компенсирующее удаление уже загруженного вложения — используется, если после
    /// успешной загрузки файла последующий шаг того же запроса (загрузка другого файла из того
    /// же батча, создание сообщения) провалился, и файл иначе остался бы orphaned.</summary>
    Task DeleteChatAttachmentAsync(string fileKey, CancellationToken ct = default);

    /// <summary>Удаляет текущую аватарку группового чата (если есть) — вызывается ДО очистки
    /// Chat.AvatarUrl на стороне Chats-модуля, тем же порядком, что и UploadGroupAvatarAsync.</summary>
    Task DeleteGroupAvatarAsync(Guid chatId, CancellationToken ct = default);
}

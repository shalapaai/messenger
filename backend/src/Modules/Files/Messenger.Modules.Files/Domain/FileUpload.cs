namespace Messenger.Modules.Files.Domain;

using Messenger.Shared.Kernel.Primitives;

public sealed class FileUpload : Entity<Guid>
{
    private FileUpload() { } // EF Core

    private FileUpload(
        Guid id, Guid uploadedBy, string fileKey,
        string originalName, string contentType,
        long sizeBytes, FileCategory category, Guid? chatId) : base(id)
    {
        UploadedBy   = uploadedBy;
        FileKey      = fileKey;
        OriginalName = originalName;
        ContentType  = contentType;
        SizeBytes    = sizeBytes;
        Category     = category;
        ChatId       = chatId;
        UploadedAt   = DateTime.UtcNow;
    }

    // Непрозрачный ключ хранилища — не зависит от провайдера (Local / S3)
    public string FileKey      { get; private set; } = string.Empty;
    public string OriginalName { get; private set; } = string.Empty;
    public string ContentType  { get; private set; } = string.Empty;
    public long   SizeBytes    { get; private set; }
    public Guid   UploadedBy   { get; private set; }
    public DateTime UploadedAt { get; private set; }
    public FileCategory Category { get; private set; }

    // Заполнено только для ChatCategory.ChatAttachment — нужно при скачивании,
    // чтобы проверить, что скачивающий состоит в этом чате (см. DownloadFile)
    public Guid? ChatId { get; private set; }

    public static FileUpload Create(
        Guid uploadedBy, string fileKey, string originalName,
        string contentType, long sizeBytes, FileCategory category, Guid? chatId = null) =>
        new(Guid.NewGuid(), uploadedBy, fileKey, originalName, contentType, sizeBytes, category, chatId);
}

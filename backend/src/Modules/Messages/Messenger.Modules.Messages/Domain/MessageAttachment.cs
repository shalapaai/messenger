namespace Messenger.Modules.Messages.Domain;

public sealed class MessageAttachment
{
    private MessageAttachment() { } // EF Core

    private MessageAttachment(Guid id, string fileUrl, string fileName, string contentType, long fileSizeBytes, int sortOrder)
    {
        Id            = id;
        FileUrl       = fileUrl;
        FileName      = fileName;
        ContentType   = contentType;
        FileSizeBytes = fileSizeBytes;
        SortOrder     = sortOrder;
    }

    public Guid   Id            { get; private set; }
    public string FileUrl       { get; private set; } = string.Empty;
    public string FileName      { get; private set; } = string.Empty;
    public string ContentType   { get; private set; } = string.Empty;
    public long   FileSizeBytes { get; private set; }
    public int    SortOrder     { get; private set; }

    public static MessageAttachment Create(string fileUrl, string fileName, string contentType, long fileSizeBytes, int sortOrder) =>
        new(Guid.NewGuid(), fileUrl, fileName, contentType, fileSizeBytes, sortOrder);
}

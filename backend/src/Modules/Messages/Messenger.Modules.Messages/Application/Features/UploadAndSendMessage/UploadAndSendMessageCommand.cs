namespace Messenger.Modules.Messages.Application.Features.UploadAndSendMessage;

using Messenger.Shared.Kernel.Abstractions;

public sealed record UploadedFile(
    Stream Content,
    string FileName,
    string ContentType,
    long   FileSizeBytes);

public sealed record UploadAndSendMessageCommand(
    Guid   ChatId,
    Guid   SenderId,
    IReadOnlyList<UploadedFile> Files,
    string? Caption = null) : ICommand<UploadAndSendMessageResult>;

public sealed record AttachmentResult(
    string FileUrl,
    string FileName,
    string ContentType,
    long   FileSizeBytes);

public sealed record UploadAndSendMessageResult(
    Guid     MessageId,
    string   Content,
    List<AttachmentResult> Attachments,
    DateTime SentAt);

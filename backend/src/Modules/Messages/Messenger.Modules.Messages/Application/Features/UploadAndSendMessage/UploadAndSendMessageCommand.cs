namespace Messenger.Modules.Messages.Application.Features.UploadAndSendMessage;

using Messenger.Shared.Kernel.Abstractions;

public sealed record UploadAndSendMessageCommand(
    Guid   ChatId,
    Guid   SenderId,
    Stream FileContent,
    string FileName,
    string ContentType,
    long   FileSizeBytes,
    string? Caption = null) : ICommand<UploadAndSendMessageResult>;

// Клиенту нужно больше, чем просто id — он не получит собственное сообщение обратно через
// SignalR (рассылка сама себе не шлётся), поэтому строит bubble локально из этого ответа,
// не дожидаясь отдельного запроса истории.
public sealed record UploadAndSendMessageResult(
    Guid     MessageId,
    string   Content,
    string   FileUrl,
    string   FileName,
    string   ContentType,
    long     FileSizeBytes,
    DateTime SentAt);

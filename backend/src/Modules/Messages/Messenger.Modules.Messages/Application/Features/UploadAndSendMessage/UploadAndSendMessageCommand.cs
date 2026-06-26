namespace Messenger.Modules.Messages.Application.Features.UploadAndSendMessage;

using Messenger.Shared.Kernel.Abstractions;

public sealed record UploadAndSendMessageCommand(
    Guid   ChatId,
    Guid   SenderId,
    Stream FileContent,
    string FileName,
    string ContentType,
    long   FileSizeBytes,
    string? Caption = null) : ICommand<Guid>;

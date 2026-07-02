namespace Messenger.Modules.Chats.Application.Features.UploadChatAvatar;

using Messenger.Shared.Kernel.Abstractions;

public sealed record UploadChatAvatarCommand(
    Guid   ChatId,
    Guid   RequesterId,
    Stream Content,
    string FileName,
    string ContentType,
    long   FileSizeBytes) : ICommand<string>;

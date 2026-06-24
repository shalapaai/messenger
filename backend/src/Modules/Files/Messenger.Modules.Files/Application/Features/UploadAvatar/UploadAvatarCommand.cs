namespace Messenger.Modules.Files.Application.Features.UploadAvatar;

using Messenger.Shared.Kernel.Abstractions;

public sealed record UploadAvatarCommand(
    Guid UserId,
    Stream FileContent,
    string FileName,
    string ContentType,
    long FileSizeBytes) : ICommand<string>; // возвращает публичный URL

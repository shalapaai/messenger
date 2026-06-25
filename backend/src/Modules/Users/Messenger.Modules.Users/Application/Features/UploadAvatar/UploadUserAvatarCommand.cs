namespace Messenger.Modules.Users.Application.Features.UploadAvatar;

using Messenger.Shared.Kernel.Abstractions;

public sealed record UploadUserAvatarCommand(
    Guid   AuthUserId,
    Stream FileContent,
    string FileName,
    string ContentType,
    long   FileSizeBytes) : ICommand<string>; // returns public AvatarUrl

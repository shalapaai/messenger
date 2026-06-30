namespace Messenger.Modules.Files.Application.Features.DeleteAvatar;

using Messenger.Shared.Kernel.Abstractions;

public sealed record DeleteAvatarCommand(Guid UserId) : ICommand;

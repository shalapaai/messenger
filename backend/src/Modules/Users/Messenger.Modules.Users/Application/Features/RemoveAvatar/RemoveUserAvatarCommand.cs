namespace Messenger.Modules.Users.Application.Features.RemoveAvatar;

using Messenger.Shared.Kernel.Abstractions;

public sealed record RemoveUserAvatarCommand(Guid AuthUserId) : ICommand;

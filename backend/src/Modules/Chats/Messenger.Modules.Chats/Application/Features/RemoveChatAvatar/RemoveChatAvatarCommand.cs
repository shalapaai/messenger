namespace Messenger.Modules.Chats.Application.Features.RemoveChatAvatar;

using Messenger.Shared.Kernel.Abstractions;

public sealed record RemoveChatAvatarCommand(
    Guid ChatId,
    Guid RequesterId) : ICommand;

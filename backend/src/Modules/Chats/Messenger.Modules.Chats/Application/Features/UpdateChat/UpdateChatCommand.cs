namespace Messenger.Modules.Chats.Application.Features.UpdateChat;

using Messenger.Shared.Kernel.Abstractions;

public sealed record UpdateChatCommand(
    Guid    ChatId,
    Guid    RequesterId,
    string? Name,
    string? AvatarUrl,
    string? AvatarColor) : ICommand;

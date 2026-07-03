namespace Messenger.Modules.Chats.Application.Features.SetChatMemberRole;

using Messenger.Shared.Kernel.Abstractions;

public sealed record SetChatMemberRoleCommand(
    Guid ChatId,
    Guid RequesterId,
    Guid UserId,
    string Role) : ICommand;

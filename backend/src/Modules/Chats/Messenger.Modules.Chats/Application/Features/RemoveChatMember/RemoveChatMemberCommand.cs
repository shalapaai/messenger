namespace Messenger.Modules.Chats.Application.Features.RemoveChatMember;

using Messenger.Shared.Kernel.Abstractions;

public sealed record RemoveChatMemberCommand(
    Guid ChatId,
    Guid RequesterId,
    Guid UserId) : ICommand;

namespace Messenger.Modules.Chats.Application.Features.AddChatMember;

using Messenger.Shared.Kernel.Abstractions;

public sealed record AddChatMemberCommand(
    Guid ChatId,
    Guid RequesterId,
    Guid UserId) : ICommand;

namespace Messenger.Modules.Chats.Application.Features.CreateGroupChat;

using Messenger.Shared.Kernel.Abstractions;

public sealed record CreateGroupChatCommand(
    Guid CreatorId,
    string Name,
    IReadOnlyList<Guid> MemberIds,
    string? AvatarColor) : ICommand<Guid>;

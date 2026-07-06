namespace Messenger.Modules.Chats.Application.Features.GetChats;

using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Shared.Kernel.Abstractions;

public sealed record GetChatsQuery(Guid CurrentUserId) : IQuery<List<ChatSummaryDto>>;

public sealed record ChatSummaryDto(
    Guid            Id,
    string          Type,
    string?         Name,
    string?         AvatarUrl,
    string?         AvatarColor,
    LastMessageDto? LastMessage,
    Guid?           OtherUserId,
    bool            IsOnline,
    DateTime?       OtherMemberLastReadAt,
    int             UnreadCount);

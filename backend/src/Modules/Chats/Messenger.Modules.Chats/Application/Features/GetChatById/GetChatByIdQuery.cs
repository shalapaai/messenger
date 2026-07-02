namespace Messenger.Modules.Chats.Application.Features.GetChatById;

using Messenger.Shared.Kernel.Abstractions;

public sealed record GetChatByIdQuery(Guid ChatId, Guid CurrentUserId) : IQuery<ChatDetailDto>;

public sealed record ChatDetailDto(
    Guid                   Id,
    string                 Type,
    string?                Name,
    string?                AvatarUrl,
    DateTime               CreatedAt,
    IReadOnlyList<ChatMemberDto> Members);

public sealed record ChatMemberDto(
    Guid     UserId,
    string   DisplayName,
    string?  AvatarUrl,
    string   AvatarColor,
    string   Role,
    DateTime JoinedAt,
    bool     Online);

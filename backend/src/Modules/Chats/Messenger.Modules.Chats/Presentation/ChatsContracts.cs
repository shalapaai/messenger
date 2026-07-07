namespace Messenger.Modules.Chats.Presentation;

public sealed record UpdateChatRequest(string? Name, string? AvatarUrl, string? AvatarColor);
public sealed record AddChatMemberRequest(Guid UserId);
public sealed record CreateDirectChatRequest(Guid OtherUserId);
public sealed record CreateGroupChatRequest(string Name, List<Guid>? MemberIds, string? AvatarColor);
public sealed record SetChatMemberRoleRequest(string Role);
public sealed record UploadChatAvatarResponse(string Url);

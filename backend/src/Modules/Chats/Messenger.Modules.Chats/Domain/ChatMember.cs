namespace Messenger.Modules.Chats.Domain;

public enum ChatMemberRole { Member, Admin, Owner }

public sealed class ChatMember
{
    private ChatMember() { } // EF Core

    internal ChatMember(ChatId chatId, Guid userId, ChatMemberRole role)
    {
        ChatId = chatId;
        UserId = userId;
        Role = role;
        JoinedAt = DateTime.UtcNow;
    }

    public ChatId ChatId { get; private set; } = default!;
    public Guid UserId { get; private set; }
    public ChatMemberRole Role { get; private set; }
    public DateTime JoinedAt { get; private set; }
    public DateTime? LastReadAt { get; private set; }

    internal void MarkAsRead() => LastReadAt = DateTime.UtcNow;
    internal void SetRole(ChatMemberRole role) => Role = role;
}

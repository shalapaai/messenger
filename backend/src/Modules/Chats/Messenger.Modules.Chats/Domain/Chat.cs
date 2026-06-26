namespace Messenger.Modules.Chats.Domain;

using Messenger.Shared.Kernel.Primitives;
using Messenger.Shared.Kernel.Results;

// ── Value types ───────────────────────────────────────────────────────────────

public record ChatId(Guid Value)
{
    public static ChatId New() => new(Guid.NewGuid());
    public static ChatId From(Guid value) => new(value);
    public override string ToString() => Value.ToString();
}

public enum ChatType { Direct, Group }

public enum ChatMemberRole { Member, Admin, Owner }

// ── Entities ──────────────────────────────────────────────────────────────────

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
}

public sealed class Chat : AggregateRoot<ChatId>
{
    private readonly List<ChatMember> _members = [];

    private Chat() { } // EF Core

    private Chat(ChatId id, ChatType type, string? name) : base(id)
    {
        Type = type;
        Name = name;
        CreatedAt = DateTime.UtcNow;
    }

    public ChatType Type { get; private set; }
    public string? Name { get; private set; }
    public string? AvatarUrl { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public IReadOnlyList<ChatMember> Members => _members.AsReadOnly();

    public static Chat CreateDirect() =>
        new(ChatId.New(), ChatType.Direct, null);

    public static Result<Chat> CreateGroup(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure<Chat>(Error.Validation("Name", "Group chat name cannot be empty"));
        if (name.Length > 100)
            return Result.Failure<Chat>(Error.Validation("Name", "Group chat name exceeds 100 characters"));
        return Result.Success(new Chat(ChatId.New(), ChatType.Group, name.Trim()));
    }

    public void AddMember(Guid userId, ChatMemberRole role = ChatMemberRole.Member)
    {
        if (_members.All(m => m.UserId != userId))
            _members.Add(new ChatMember(Id, userId, role));
    }

    public Result RemoveMember(Guid requesterId, Guid userId)
    {
        var requester = _members.FirstOrDefault(m => m.UserId == requesterId);
        if (requester is null)
            return Result.Failure(Error.Forbidden("You are not a member of this chat"));

        var target = _members.FirstOrDefault(m => m.UserId == userId);
        if (target is null)
            return Result.Failure(Error.NotFound("Member"));

        if (requesterId == userId)
        {
            _members.Remove(target);
            return Result.Success();
        }

        if (requester.Role == ChatMemberRole.Member)
            return Result.Failure(Error.Forbidden("Only admins can remove other members"));

        if (target.Role == ChatMemberRole.Owner)
            return Result.Failure(Error.Forbidden("Cannot remove the chat owner"));

        _members.Remove(target);
        return Result.Success();
    }
}

// ── Repository contract ───────────────────────────────────────────────────────

public interface IChatRepository
{
    Task<Chat?> GetByIdAsync(ChatId id, CancellationToken ct = default);
    Task<Guid?> FindDirectChatIdAsync(Guid userId1, Guid userId2, CancellationToken ct = default);
    Task<List<Chat>> GetByUserIdAsync(Guid userId, CancellationToken ct = default);
    void Add(Chat chat);
}

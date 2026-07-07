namespace Messenger.Modules.Chats.Domain;

using Messenger.Modules.Chats.Domain.Events;
using Messenger.Shared.Kernel.Primitives;
using Messenger.Shared.Kernel.Results;

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
    /// <summary>Только для Group — цвет фолбэк-аватарки, выбранный при создании группы (пока нет
    /// загруженной картинки). Direct-чаты берут цвет из профиля собеседника, а не отсюда.</summary>
    public string? AvatarColor { get; private set; }
    public DateTime CreatedAt { get; private set; }

    // Заполняются только для Direct-чатов, всегда в каноническом порядке (меньший Guid первым) —
    // основа для уникального индекса (см. ChatsDbContext), не позволяющего двум одновременным
    // запросам создать два разных direct-чата между одной и той же парой пользователей.
    public Guid? DirectUserId1 { get; private set; }
    public Guid? DirectUserId2 { get; private set; }

    public IReadOnlyList<ChatMember> Members => _members.AsReadOnly();
    public bool IsEmpty => _members.Count == 0;

    public static Chat CreateDirect(Guid userId1, Guid userId2)
    {
        var (first, second) = userId1.CompareTo(userId2) <= 0 ? (userId1, userId2) : (userId2, userId1);
        return new Chat(ChatId.New(), ChatType.Direct, null)
        {
            DirectUserId1 = first,
            DirectUserId2 = second,
        };
    }

    public static Result<Chat> CreateGroup(string name, string? avatarColor = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure<Chat>(Error.Validation("Name", "Group chat name cannot be empty"));
        if (name.Length > 100)
            return Result.Failure<Chat>(Error.Validation("Name", "Group chat name exceeds 100 characters"));
        return Result.Success(new Chat(ChatId.New(), ChatType.Group, name.Trim()) { AvatarColor = avatarColor });
    }

    public void AddMember(Guid userId, ChatMemberRole role = ChatMemberRole.Member)
    {
        if (_members.All(m => m.UserId != userId))
            _members.Add(new ChatMember(Id, userId, role));
    }

    /// <summary>Уведомление "состав участников изменился" — рассылается всем ТЕКУЩИМ участникам
    /// (а не только вновь добавленному), иначе те, кто уже состоит в группе, не увидят обновлённый
    /// ростер/счётчик участников в реальном времени. Вызывается явно из хендлера, а не автоматически
    /// из AddMember — при создании группы в цикле AddMember это дало бы событие на каждого участника
    /// вместо одного общего.</summary>
    public void NotifyMembershipChanged() =>
        RaiseDomainEvent(new ChatUpdatedDomainEvent(Id.Value, _members.Select(m => m.UserId).ToList()));

    public Result UpdateInfo(Guid requesterId, string? name, string? avatarUrl, string? avatarColor = null)
    {
        var requester = _members.FirstOrDefault(m => m.UserId == requesterId);
        if (requester is null)
            return Result.Failure(Error.Forbidden("You are not a member of this chat"));

        if (requester.Role == ChatMemberRole.Member)
            return Result.Failure(Error.Forbidden("Only admins can update chat info"));

        if (name is not null)
        {
            if (string.IsNullOrWhiteSpace(name))
                return Result.Failure(Error.Validation("Name", "Group chat name cannot be empty"));
            if (name.Length > 100)
                return Result.Failure(Error.Validation("Name", "Group chat name exceeds 100 characters"));
            Name = name.Trim();
        }

        if (avatarUrl is not null)
            AvatarUrl = avatarUrl;

        if (avatarColor is not null)
            AvatarColor = avatarColor;

        NotifyMembershipChanged();
        return Result.Success();
    }

    /// <summary>Явно очищает аватарку (в отличие от UpdateInfo, где avatarUrl: null означает
    /// "не менять") — после этого фолбэк-цвет AvatarColor снова становится видимым в списке чатов.</summary>
    public Result ClearAvatar(Guid requesterId)
    {
        var requester = _members.FirstOrDefault(m => m.UserId == requesterId);
        if (requester is null)
            return Result.Failure(Error.Forbidden("You are not a member of this chat"));

        if (requester.Role == ChatMemberRole.Member)
            return Result.Failure(Error.Forbidden("Only admins can update chat info"));

        AvatarUrl = null;
        NotifyMembershipChanged();
        return Result.Success();
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
            if (requester.Role == ChatMemberRole.Owner)
            {
                // Transfer ownership: prefer an existing admin, otherwise pick any member
                var newOwner = _members
                    .Where(m => m.UserId != userId)
                    .OrderByDescending(m => (int)m.Role)
                    .FirstOrDefault();
                newOwner?.SetRole(ChatMemberRole.Owner);
            }
            _members.Remove(target);
            NotifyMemberRemoved(userId);
            return Result.Success();
        }

        if (requester.Role == ChatMemberRole.Member)
            return Result.Failure(Error.Forbidden("Only admins can remove other members"));

        if (target.Role == ChatMemberRole.Owner)
            return Result.Failure(Error.Forbidden("Cannot remove the chat owner"));

        if (requester.Role == ChatMemberRole.Admin && target.Role == ChatMemberRole.Admin)
            return Result.Failure(Error.Forbidden("Admins cannot remove other admins"));

        _members.Remove(target);
        NotifyMemberRemoved(userId);
        return Result.Success();
    }

    /// <summary>Уведомляет оставшихся участников (чтобы обновить ростер) И самого удалённого
    /// (чтобы у него этот чат сразу пропал из списка) — на момент вызова removedUserId уже не в _members.</summary>
    private void NotifyMemberRemoved(Guid removedUserId) =>
        RaiseDomainEvent(new ChatUpdatedDomainEvent(Id.Value, _members.Select(m => m.UserId).Append(removedUserId).ToList()));

    public Result MarkMemberAsRead(Guid userId)
    {
        var member = _members.FirstOrDefault(m => m.UserId == userId);
        if (member is null) return Result.Failure(Error.Forbidden("You are not a member of this chat"));
        member.MarkAsRead();
        RaiseDomainEvent(new ChatReadDomainEvent(Id.Value, userId, member.LastReadAt!.Value));
        return Result.Success();
    }

    public Result SetMemberRole(Guid requesterId, Guid userId, ChatMemberRole newRole)
    {
        var requester = _members.FirstOrDefault(m => m.UserId == requesterId);
        if (requester is null)
            return Result.Failure(Error.Forbidden("You are not a member of this chat"));

        if (requester.Role != ChatMemberRole.Owner)
            return Result.Failure(Error.Forbidden("Only the owner can change member roles"));

        if (requesterId == userId)
            return Result.Failure(Error.Validation("UserId", "Cannot change your own role"));

        var target = _members.FirstOrDefault(m => m.UserId == userId);
        if (target is null)
            return Result.Failure(Error.NotFound("Member"));

        if (target.Role == ChatMemberRole.Owner)
            return Result.Failure(Error.Forbidden("Cannot change the owner's role"));

        target.SetRole(newRole);
        NotifyMembershipChanged();
        return Result.Success();
    }

    public Result EnsureCanBeDeletedBy(Guid requesterId)
    {
        if (Type != ChatType.Direct)
            return Result.Failure(Error.Validation("ChatType", "Use leave/remove member to exit a group chat"));

        if (_members.All(m => m.UserId != requesterId))
            return Result.Failure(Error.Forbidden("You are not a member of this chat"));

        return Result.Success();
    }
}

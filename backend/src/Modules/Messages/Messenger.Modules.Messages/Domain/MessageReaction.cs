namespace Messenger.Modules.Messages.Domain;

public sealed class MessageReaction
{
    private MessageReaction() { }

    private MessageReaction(Guid id, Guid userId, string emoji)
    {
        Id = id;
        UserId = userId;
        Emoji = emoji;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string Emoji { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public static MessageReaction Create(Guid userId, string emoji) =>
        new(Guid.NewGuid(), userId, emoji);

    public void Update(string emoji)
    {
        Emoji = emoji;
        UpdatedAt = DateTime.UtcNow;
    }
}

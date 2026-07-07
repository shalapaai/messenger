namespace Messenger.Modules.Chats.Domain;

public record ChatId(Guid Value)
{
    public static ChatId New() => new(Guid.NewGuid());
    public static ChatId From(Guid value) => new(value);
    public override string ToString() => Value.ToString();
}

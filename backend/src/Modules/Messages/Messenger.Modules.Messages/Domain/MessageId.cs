namespace Messenger.Modules.Messages.Domain;

public record MessageId(Guid Value)
{
    public static MessageId New() => new(Guid.NewGuid());
    public static MessageId From(Guid value) => new(value);
    public override string ToString() => Value.ToString();
}

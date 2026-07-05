namespace Messenger.Modules.Messages.Domain;

public record MessageId(Guid Value) : IComparable<MessageId>
{
    public static MessageId New() => new(Guid.NewGuid());
    public static MessageId From(Guid value) => new(value);
    public override string ToString() => Value.ToString();

    // Arbitrary but deterministic ordering — used purely as a tie-breaker for cursor pagination
    // when two messages share an identical SentAt (see MessageRepository.GetByChatIdCursorAsync).
    // Comparing via the whole property (not .Value) is required: EF Core can translate `<` on a
    // converted property through a custom operator, but decomposing to `.Value` inside Where/OrderBy
    // fails to translate ("could not be translated") even though it works inside a terminal Select.
    public int CompareTo(MessageId? other) => Value.CompareTo(other?.Value ?? Guid.Empty);
    public static bool operator <(MessageId a, MessageId b)  => a.Value < b.Value;
    public static bool operator >(MessageId a, MessageId b)  => a.Value > b.Value;
    public static bool operator <=(MessageId a, MessageId b) => a.Value <= b.Value;
    public static bool operator >=(MessageId a, MessageId b) => a.Value >= b.Value;
}

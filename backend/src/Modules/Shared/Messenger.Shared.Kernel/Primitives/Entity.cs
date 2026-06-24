namespace Messenger.Shared.Kernel.Primitives;

public abstract class Entity<TId>
{
    protected Entity(TId id) => Id = id;
    protected Entity() { } // EF Core

    public TId Id { get; protected set; } = default!;

    public override bool Equals(object? obj)
    {
        if (obj is not Entity<TId> other) return false;
        if (ReferenceEquals(this, other)) return true;
        return Id!.Equals(other.Id);
    }

    public override int GetHashCode() => Id!.GetHashCode();

    public static bool operator ==(Entity<TId>? left, Entity<TId>? right) =>
        left is not null && right is not null && left.Equals(right);

    public static bool operator !=(Entity<TId>? left, Entity<TId>? right) => !(left == right);
}

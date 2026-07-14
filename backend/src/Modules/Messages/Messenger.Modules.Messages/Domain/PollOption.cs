namespace Messenger.Modules.Messages.Domain;

public sealed class PollOption
{
    private PollOption() { } // EF Core

    private PollOption(Guid id, string text, int sortOrder)
    {
        Id = id;
        Text = text;
        SortOrder = sortOrder;
    }

    public Guid   Id        { get; private set; }
    public string Text      { get; private set; } = string.Empty;
    public int    SortOrder { get; private set; }

    public static PollOption Create(string text, int sortOrder) =>
        new(Guid.NewGuid(), text, sortOrder);
}

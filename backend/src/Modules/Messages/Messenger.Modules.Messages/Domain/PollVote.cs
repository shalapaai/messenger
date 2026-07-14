namespace Messenger.Modules.Messages.Domain;

public sealed class PollVote
{
    private PollVote() { } // EF Core

    private PollVote(Guid id, Guid optionId, Guid userId)
    {
        Id = id;
        OptionId = optionId;
        UserId = userId;
        VotedAt = DateTime.UtcNow;
    }

    public Guid     Id       { get; private set; }
    public Guid     OptionId { get; private set; }
    public Guid     UserId   { get; private set; }
    public DateTime VotedAt  { get; private set; }

    public static PollVote Create(Guid optionId, Guid userId) =>
        new(Guid.NewGuid(), optionId, userId);
}

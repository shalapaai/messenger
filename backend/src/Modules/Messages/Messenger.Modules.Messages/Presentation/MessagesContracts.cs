namespace Messenger.Modules.Messages.Presentation;

public sealed record SendMessageRequest(string Content, Guid? ReplyToMessageId = null);
public sealed record EditMessageRequest(string NewContent);
public sealed record SetMessageReactionRequest(string? Emoji);
public sealed record ForwardMessagesRequest(Guid SourceChatId, List<Guid> MessageIds);
public sealed record DeleteMessagesRequest(List<Guid> MessageIds);
public sealed record CreatePollRequest(string Question, List<string> Options);
public sealed record SetPollVoteRequest(Guid OptionId);

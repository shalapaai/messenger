namespace Messenger.Modules.Messages.Application.Features.SearchMessages;

using Messenger.Shared.Kernel.Abstractions;

public sealed record SearchMessagesQuery(
    Guid   ChatId,
    Guid   CurrentUserId,
    string QueryText) : IQuery<List<MessageSearchResultDto>>;

public sealed record MessageSearchResultDto(
    Guid     MessageId,
    Guid     SenderId,
    string   SenderName,
    string   Content,
    DateTime SentAt);

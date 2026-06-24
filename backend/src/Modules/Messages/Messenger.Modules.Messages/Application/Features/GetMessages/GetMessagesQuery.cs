namespace Messenger.Modules.Messages.Application.Features.GetMessages;

using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Pagination;

public sealed record GetMessagesQuery(
    Guid ChatId,
    int Page = 1,
    int PageSize = 50) : IQuery<PagedList<MessageDto>>;

public sealed record MessageDto(
    Guid Id,
    Guid ChatId,
    Guid SenderId,
    string Content,
    string Status,
    DateTime SentAt,
    DateTime? EditedAt,
    Guid? ReplyToMessageId);

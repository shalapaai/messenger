namespace Messenger.Modules.Messages.Application.Features.GetMessages;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class GetMessagesQueryHandler(IMessageRepository messageRepository)
    : IQueryHandler<GetMessagesQuery, MessagesPageDto>
{
    public async Task<Result<MessagesPageDto>> Handle(GetMessagesQuery query, CancellationToken ct)
    {
        var limit = Math.Clamp(query.Limit, 1, 100);

        var raw = await messageRepository.GetByChatIdCursorAsync(query.ChatId, query.Before, limit + 1, ct);

        var hasMore = raw.Count > limit;
        var items = hasMore ? raw.Take(limit).ToList() : raw;

        var dtos = items
            .Select(m => new MessageDto(
                m.Id.Value,
                m.ChatId,
                m.SenderId,
                m.Content,
                m.FileUrl,
                m.Status.ToString().ToLower(),
                m.SentAt,
                m.EditedAt,
                m.ReplyToMessageId))
            .ToList();

        var nextCursor = hasMore ? items.Last().Id.Value : (Guid?)null;

        return Result.Success(new MessagesPageDto(dtos, nextCursor));
    }
}

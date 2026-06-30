namespace Messenger.Modules.Messages.Application.Features.GetMessages;

using Messenger.Modules.Messages.Domain;
using Messenger.Modules.Users.Application.Contracts;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class GetMessagesQueryHandler(
    IMessageRepository messageRepository,
    IUsersModule       usersModule)
    : IQueryHandler<GetMessagesQuery, MessagesPageDto>
{
    public async Task<Result<MessagesPageDto>> Handle(GetMessagesQuery query, CancellationToken ct)
    {
        var limit = Math.Clamp(query.Limit, 1, 100);

        var raw = await messageRepository.GetByChatIdCursorAsync(query.ChatId, query.Before, limit + 1, ct);

        var hasMore = raw.Count > limit;
        var items = hasMore ? raw.Take(limit).ToList() : raw;

        var senderIds = items.Select(m => m.SenderId).Distinct().ToList();
        var summariesResult = await usersModule.GetSummariesByAuthUserIdsAsync(senderIds, ct);
        if (summariesResult.IsFailure)
            return Result.Failure<MessagesPageDto>(summariesResult.Error);

        var summaries = summariesResult.Value!;

        var dtos = items
            .Select(m =>
            {
                summaries.TryGetValue(m.SenderId, out var summary);
                return new MessageDto(
                    m.Id.Value,
                    m.ChatId,
                    m.SenderId,
                    summary?.DisplayName ?? "Пользователь",
                    summary?.AvatarUrl,
                    m.Content,
                    m.FileUrl,
                    m.Status.ToString().ToLower(),
                    m.SentAt,
                    m.EditedAt,
                    m.ReplyToMessageId);
            })
            .ToList();

        var nextCursor = hasMore ? items.Last().Id.Value : (Guid?)null;

        return Result.Success(new MessagesPageDto(dtos, nextCursor));
    }
}

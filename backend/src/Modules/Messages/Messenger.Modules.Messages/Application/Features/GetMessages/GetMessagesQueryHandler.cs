namespace Messenger.Modules.Messages.Application.Features.GetMessages;

using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Modules.Messages.Domain;
using Messenger.Modules.Users.Application.Contracts;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;

public sealed class GetMessagesQueryHandler(
    IMessageRepository     messageRepository,
    IUsersModule           usersModule,
    IChatMembershipChecker membershipChecker)
    : IQueryHandler<GetMessagesQuery, MessagesPageDto>
{
    public async Task<Result<MessagesPageDto>> Handle(GetMessagesQuery query, CancellationToken ct)
    {
        if (!await membershipChecker.IsMemberAsync(query.ChatId, query.CurrentUserId, ct))
            return Result.Failure<MessagesPageDto>(Error.Forbidden("You are not a member of this chat"));

        var limit = Math.Clamp(query.Limit, 1, 100);

        var raw = await messageRepository.GetByChatIdCursorAsync(query.ChatId, query.Before, limit + 1, ct);

        var hasMore = raw.Count > limit;
        var items = hasMore ? raw.Take(limit).ToList() : raw;

        // сообщения-источники цитат (reply) — подгружаем одним запросом, а не по одному на каждое
        var replyIds = items.Where(m => m.ReplyToMessageId.HasValue).Select(m => m.ReplyToMessageId!.Value).Distinct().ToList();
        var replySources = replyIds.Count > 0
            ? await messageRepository.GetByIdsAsync(replyIds.Select(MessageId.From).ToList(), ct)
            : [];
        var replySourceById = replySources.ToDictionary(m => m.Id.Value);

        var userIds = items
            .SelectMany(m => m.ForwardedFromUserId is { } fwId ? new[] { m.SenderId, fwId } : [m.SenderId])
            .Concat(replySources.Select(m => m.SenderId))
            .Distinct()
            .ToList();
        var summariesResult = await usersModule.GetSummariesByAuthUserIdsAsync(userIds, ct);
        if (summariesResult.IsFailure)
            return Result.Failure<MessagesPageDto>(summariesResult.Error);

        var summaries = summariesResult.Value!;

        var dtos = items
            .Select(m =>
            {
                summaries.TryGetValue(m.SenderId, out var summary);
                UserSummaryDto? forwardedFromUser = null;
                if (m.ForwardedFromUserId is { } fwId) summaries.TryGetValue(fwId, out forwardedFromUser);

                string? replyToSenderName = null;
                string? replyToContent = null;
                if (m.ReplyToMessageId is { } replyId && replySourceById.TryGetValue(replyId, out var replySrc))
                {
                    summaries.TryGetValue(replySrc.SenderId, out var replySummary);
                    replyToSenderName = replySummary?.DisplayName ?? "Пользователь";
                    replyToContent    = replySrc.Status == MessageStatus.Deleted ? null : MessagePreview.Truncate(replySrc.Content);
                }

                return new MessageDto(
                    m.Id.Value,
                    m.ChatId,
                    m.SenderId,
                    summary?.DisplayName ?? "Пользователь",
                    summary?.AvatarUrl,
                    summary?.AvatarColor ?? "#2C5BF0",
                    m.Content,
                    m.FileUrl,
                    m.FileName,
                    m.FileContentType,
                    m.FileSizeBytes,
                    m.Status.ToString().ToLower(),
                    m.SentAt,
                    m.EditedAt,
                    m.ReplyToMessageId,
                    replyToSenderName,
                    replyToContent,
                    m.ForwardedFromUserId,
                    forwardedFromUser?.DisplayName);
            })
            .ToList();

        var nextCursor = hasMore ? items.Last().Id.Value : (Guid?)null;

        return Result.Success(new MessagesPageDto(dtos, nextCursor));
    }
}

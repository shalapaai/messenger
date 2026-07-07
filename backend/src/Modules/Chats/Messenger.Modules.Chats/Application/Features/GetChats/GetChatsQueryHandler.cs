namespace Messenger.Modules.Chats.Application.Features.GetChats;

using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Modules.Users.Application.Contracts;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Presence;
using Messenger.Shared.Kernel.Results;

public sealed class GetChatsQueryHandler(
    IChatRepository  chatRepository,
    IMessagesModule  messagesModule,
    IUsersModule     usersModule,
    IPresenceTracker presence)
    : IQueryHandler<GetChatsQuery, List<ChatSummaryDto>>
{
    public async Task<Result<List<ChatSummaryDto>>> Handle(GetChatsQuery query, CancellationToken ct)
    {
        var chats = await chatRepository.GetByUserIdAsync(query.CurrentUserId, ct);

        var chatIds = chats.Select(c => c.Id.Value).ToList();

        var lastMessagesResult = await messagesModule.GetLastMessagesByChatIdsAsync(chatIds, ct);
        if (lastMessagesResult.IsFailure)
            return Result.Failure<List<ChatSummaryDto>>(lastMessagesResult.Error);

        var lastMessages = lastMessagesResult.Value!;

        // Свой собственный last_read_at по каждому чату — основа для реального счётчика
        // непрочитанных (см. ниже), а не только для "прочитано собеседником" (otherMemberLastReadAt).
        var myLastReadAtByChatId = chats.ToDictionary(
            c => c.Id.Value,
            c => c.Members.FirstOrDefault(m => m.UserId == query.CurrentUserId)?.LastReadAt);

        var unreadCountsResult = await messagesModule.GetUnreadCountsByChatIdsAsync(
            query.CurrentUserId, myLastReadAtByChatId, ct);
        if (unreadCountsResult.IsFailure)
            return Result.Failure<List<ChatSummaryDto>>(unreadCountsResult.Error);

        var unreadCounts = unreadCountsResult.Value!;

        // Для личных чатов без имени резолвим displayName собеседника
        var otherUserIds = chats
            .Where(c => c.Type == ChatType.Direct)
            .SelectMany(c => c.Members.Select(m => m.UserId))
            .Where(uid => uid != query.CurrentUserId)
            .Distinct()
            .ToList();

        // Независимые вызовы в разные хранилища (UsersDbContext и Redis) — безопасно параллелить,
        // как и в GetChatByIdQueryHandler.
        var summariesTask = usersModule.GetSummariesByAuthUserIdsAsync(otherUserIds, ct);
        var onlineTask     = presence.GetOnlineAsync(otherUserIds, ct);
        await Task.WhenAll(summariesTask, onlineTask);

        var summariesResult = summariesTask.Result;
        if (summariesResult.IsFailure)
            return Result.Failure<List<ChatSummaryDto>>(summariesResult.Error);

        var userSummaries = summariesResult.Value!;
        var onlineUserIds = onlineTask.Result;

        var result = chats
            .Select(c =>
            {
                lastMessages.TryGetValue(c.Id.Value, out var lastMessage);

                var name        = c.Name;
                var avatarUrl   = c.AvatarUrl;
                var avatarColor = c.AvatarColor;
                Guid? otherUserId = null;

                DateTime? otherMemberLastReadAt = null;

                if (c.Type == ChatType.Direct)
                {
                    otherUserId = c.Members.Select(m => m.UserId).FirstOrDefault(uid => uid != query.CurrentUserId);
                    if (otherUserId.HasValue && userSummaries.TryGetValue(otherUserId.Value, out var summary))
                    {
                        name        = name      ?? summary.DisplayName;
                        avatarUrl   = avatarUrl ?? summary.AvatarUrl;
                        avatarColor = summary.AvatarColor;
                    }
                    otherMemberLastReadAt = c.Members
                        .FirstOrDefault(m => m.UserId == otherUserId)?.LastReadAt;
                }
                else if (c.Type == ChatType.Group)
                {
                    // "Прочитано хотя бы одним из остальных" — та же семантика, что и в live-событии
                    // MessagesRead, иначе чекмарки откатывались бы на "отправлено" после перезагрузки.
                    otherMemberLastReadAt = c.Members
                        .Where(m => m.UserId != query.CurrentUserId)
                        .Select(m => m.LastReadAt)
                        .Max();
                }

                unreadCounts.TryGetValue(c.Id.Value, out var unreadCount);

                return new ChatSummaryDto(
                    c.Id.Value,
                    c.Type.ToString().ToLower(),
                    name,
                    avatarUrl,
                    avatarColor,
                    lastMessage,
                    otherUserId,
                    otherUserId.HasValue && onlineUserIds.Contains(otherUserId.Value),
                    otherMemberLastReadAt,
                    unreadCount);
            })
            .OrderByDescending(c => c.LastMessage?.SentAt)
            .ToList();

        return Result.Success(result);
    }
}

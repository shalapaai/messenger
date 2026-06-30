namespace Messenger.Modules.Chats.Application.Features.GetChats;

using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Modules.Users.Application.Contracts;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;
using StackExchange.Redis;

public sealed class GetChatsQueryHandler(
    IChatRepository        chatRepository,
    IMessagesModule        messagesModule,
    IUsersModule           usersModule,
    IConnectionMultiplexer redis)
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

        // Для личных чатов без имени резолвим displayName собеседника
        var otherUserIds = chats
            .Where(c => c.Type == ChatType.Direct)
            .SelectMany(c => c.Members.Select(m => m.UserId))
            .Where(uid => uid != query.CurrentUserId)
            .Distinct()
            .ToList();

        var summariesResult = await usersModule.GetSummariesByAuthUserIdsAsync(otherUserIds, ct);
        if (summariesResult.IsFailure)
            return Result.Failure<List<ChatSummaryDto>>(summariesResult.Error);

        var userSummaries = summariesResult.Value!;

        // Текущий онлайн-статус собеседников — presence-ключи пишет MessengerHub при подключении
        var db = redis.GetDatabase();
        var batch = db.CreateBatch();
        var presenceTasks = otherUserIds.ToDictionary(
            uid => uid,
            uid => batch.KeyExistsAsync($"presence:{uid}"));
        batch.Execute();
        await Task.WhenAll(presenceTasks.Values);
        var onlineUserIds = presenceTasks.Where(kv => kv.Value.Result).Select(kv => kv.Key).ToHashSet();

        var result = chats
            .Select(c =>
            {
                lastMessages.TryGetValue(c.Id.Value, out var lastMessage);

                var name      = c.Name;
                var avatarUrl = c.AvatarUrl;
                Guid? otherUserId = null;

                if (c.Type == ChatType.Direct)
                {
                    otherUserId = c.Members.Select(m => m.UserId).FirstOrDefault(uid => uid != query.CurrentUserId);
                    if (name is null && userSummaries.TryGetValue(otherUserId.Value, out var summary))
                    {
                        name      = summary.DisplayName;
                        avatarUrl = summary.AvatarUrl;
                    }
                }

                return new ChatSummaryDto(
                    c.Id.Value,
                    c.Type.ToString().ToLower(),
                    name,
                    avatarUrl,
                    lastMessage,
                    otherUserId,
                    otherUserId.HasValue && onlineUserIds.Contains(otherUserId.Value));
            })
            .OrderByDescending(c => c.LastMessage?.SentAt)
            .ToList();

        return Result.Success(result);
    }
}

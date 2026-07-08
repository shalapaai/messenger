namespace Messenger.Modules.Chats.Application.Features.GetChatById;

using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Users.Application.Contracts;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Presence;
using Messenger.Shared.Kernel.Results;

public sealed class GetChatByIdQueryHandler(
    IChatRepository  chatRepository,
    IUsersModule     usersModule,
    IPresenceTracker presence)
    : IQueryHandler<GetChatByIdQuery, ChatDetailDto>
{
    public async Task<Result<ChatDetailDto>> Handle(GetChatByIdQuery query, CancellationToken ct)
    {
        var chat = await chatRepository.GetByIdAsync(ChatId.From(query.ChatId), ct);

        if (chat is null)
            return Result.Failure<ChatDetailDto>(Error.NotFound("Chat"));

        if (chat.Members.All(m => m.UserId != query.CurrentUserId))
            return Result.Failure<ChatDetailDto>(Error.Forbidden("You are not a member of this chat"));

        var memberIds = chat.Members.Select(m => m.UserId).ToList();

        // Независимые вызовы в разные хранилища (UsersDbContext и Redis) — безопасно параллелить,
        // в отличие от ForwardMessagesCommandHandler, где оба вызова шли через один DbContext
        var summariesTask = usersModule.GetSummariesByAuthUserIdsAsync(memberIds, ct);
        var onlineTask = presence.GetOnlineAsync(memberIds, ct);
        await Task.WhenAll(summariesTask, onlineTask);

        var summariesResult = summariesTask.Result;
        if (summariesResult.IsFailure)
            return Result.Failure<ChatDetailDto>(summariesResult.Error);

        var summaries = summariesResult.Value!;
        var onlineUserIds = onlineTask.Result;

        var dto = new ChatDetailDto(
            chat.Id.Value,
            chat.Type.ToString().ToLower(),
            chat.Name,
            chat.AvatarUrl,
            chat.CreatedAt,
            chat.Members
                .Select(m =>
                {
                    summaries.TryGetValue(m.UserId, out var summary);
                    return new ChatMemberDto(
                        m.UserId,
                        summary?.DisplayName ?? "Пользователь",
                        summary?.AvatarUrl,
                        summary?.AvatarColor ?? "#2C5BF0",
                        m.Role.ToString().ToLower(),
                        m.JoinedAt,
                        onlineUserIds.Contains(m.UserId));
                })
                .ToList());

        return Result.Success(dto);
    }
}

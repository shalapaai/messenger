namespace Messenger.Modules.Chats.Application.Features.GetChatById;

using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class GetChatByIdQueryHandler(IChatRepository chatRepository)
    : IQueryHandler<GetChatByIdQuery, ChatDetailDto>
{
    public async Task<Result<ChatDetailDto>> Handle(GetChatByIdQuery query, CancellationToken ct)
    {
        var chat = await chatRepository.GetByIdAsync(ChatId.From(query.ChatId), ct);

        if (chat is null)
            return Result.Failure<ChatDetailDto>(Error.NotFound("Chat"));

        if (chat.Members.All(m => m.UserId != query.CurrentUserId))
            return Result.Failure<ChatDetailDto>(Error.Forbidden("You are not a member of this chat"));

        var dto = new ChatDetailDto(
            chat.Id.Value,
            chat.Type.ToString().ToLower(),
            chat.Name,
            chat.AvatarUrl,
            chat.CreatedAt,
            chat.Members
                .Select(m => new ChatMemberDto(m.UserId, m.Role.ToString().ToLower(), m.JoinedAt))
                .ToList());

        return Result.Success(dto);
    }
}

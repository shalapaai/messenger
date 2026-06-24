namespace Messenger.Modules.Messages.Application.Features.GetMessages;

using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Pagination;
using Messenger.Shared.Kernel.Results;

public sealed class GetMessagesQueryHandler(IMessageRepository messageRepository)
    : IQueryHandler<GetMessagesQuery, PagedList<MessageDto>>
{
    public async Task<Result<PagedList<MessageDto>>> Handle(GetMessagesQuery query, CancellationToken ct)
    {
        var messages = await messageRepository.GetByChatIdAsync(query.ChatId, query.Page, query.PageSize, ct);

        var dtos = messages.Items
            .Select(m => new MessageDto(
                m.Id.Value,
                m.ChatId,
                m.SenderId,
                m.Content,
                m.Status.ToString(),
                m.SentAt,
                m.EditedAt,
                m.ReplyToMessageId))
            .ToList();

        return Result.Success(new PagedList<MessageDto>(dtos, messages.Page, messages.PageSize, messages.TotalCount));
    }
}

namespace Messenger.Modules.Messages;

using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Modules.Messages.Domain;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

// Реализация публичного API модуля — вызывается другими модулями через IMessagesModule
internal sealed class MessagesModuleApi(
    Infrastructure.MessagesDbContext dbContext,
    IMessageRepository messageRepository)
    : IMessagesModule
{
    public async Task<Result<int>> GetMessageCountInChatAsync(Guid chatId, CancellationToken ct = default)
    {
        var count = await messageRepository.CountByChatIdAsync(chatId, ct);
        return Result.Success(count);
    }

    public async Task<Result> DeleteAllMessagesInChatAsync(Guid chatId, CancellationToken ct = default)
    {
        await dbContext.Messages
            .Where(m => m.ChatId == chatId)
            .ExecuteDeleteAsync(ct);

        return Result.Success();
    }

    public async Task<Result<Dictionary<Guid, LastMessageDto>>> GetLastMessagesByChatIdsAsync(
        IReadOnlyList<Guid> chatIds, CancellationToken ct = default)
    {
        if (chatIds.Count == 0)
            return Result.Success(new Dictionary<Guid, LastMessageDto>());

        var messages = await dbContext.Messages
            .Where(m => chatIds.Contains(m.ChatId) && m.Status != MessageStatus.Deleted)
            .GroupBy(m => m.ChatId)
            .Select(g => g.OrderByDescending(m => m.SentAt).First())
            .ToListAsync(ct);

        var dict = messages.ToDictionary(
            m => m.ChatId,
            m => new LastMessageDto(m.Id.Value, m.SenderId, m.Content, m.SentAt));

        return Result.Success(dict);
    }
}

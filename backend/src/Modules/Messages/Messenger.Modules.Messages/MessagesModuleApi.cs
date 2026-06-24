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
}

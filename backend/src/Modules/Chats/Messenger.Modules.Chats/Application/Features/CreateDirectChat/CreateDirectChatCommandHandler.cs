namespace Messenger.Modules.Chats.Application.Features.CreateDirectChat;

using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

public sealed class CreateDirectChatCommandHandler(
    IChatRepository chatRepository,
    IUnitOfWork unitOfWork)
    : ICommandHandler<CreateDirectChatCommand, Guid>
{
    public async Task<Result<Guid>> Handle(CreateDirectChatCommand command, CancellationToken ct)
    {
        if (command.CurrentUserId == command.OtherUserId)
            return Result.Failure<Guid>(Error.Validation("OtherUserId", "Cannot create a direct chat with yourself"));

        var existingId = await chatRepository.FindDirectChatIdAsync(command.CurrentUserId, command.OtherUserId, ct);
        if (existingId is not null)
            return Result.Success(existingId.Value);

        var chat = Chat.CreateDirect(command.CurrentUserId, command.OtherUserId);
        chatRepository.Add(chat);

        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // TOCTOU: два одновременных "начать диалог" между теми же двумя пользователями оба
            // проходят проверку выше — второй SaveChangesAsync падает на уникальном direct_key.
            // Не роняем запрос ошибкой — отдаём id чата, который выиграл гонку (тот же паттерн,
            // что в AddChatMemberCommandHandler, но тут ещё нужно вернуть id, а не просто отказ).
            var winnerId = await chatRepository.FindDirectChatIdAsync(command.CurrentUserId, command.OtherUserId, ct);
            if (winnerId is not null)
                return Result.Success(winnerId.Value);
            throw;
        }

        return Result.Success(chat.Id.Value);
    }
}

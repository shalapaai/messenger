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
        chat.AddMember(command.CurrentUserId);
        chat.AddMember(command.OtherUserId);

        chatRepository.Add(chat);

        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // TOCTOU: параллельный запрос уже создал этот чат — второй SaveChangesAsync падает
            // на ux_chats_direct_pair. Возвращаем уже существующий чат, а не 500.
            var existingAfterConflict = await chatRepository.FindDirectChatIdAsync(command.CurrentUserId, command.OtherUserId, ct);
            if (existingAfterConflict is not null)
                return Result.Success(existingAfterConflict.Value);

            throw;
        }

        return Result.Success(chat.Id.Value);
    }
}

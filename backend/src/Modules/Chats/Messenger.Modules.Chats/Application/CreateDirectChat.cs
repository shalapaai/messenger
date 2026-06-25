namespace Messenger.Modules.Chats.Application;

using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

public sealed record CreateDirectChatCommand(Guid CurrentUserId, Guid OtherUserId) : ICommand<Guid>;

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

        var chat = Chat.CreateDirect();
        chat.AddMember(command.CurrentUserId);
        chat.AddMember(command.OtherUserId);

        chatRepository.Add(chat);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(chat.Id.Value);
    }
}

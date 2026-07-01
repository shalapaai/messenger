namespace Messenger.Modules.Chats.Application.Features.MarkChatRead;

using Messenger.Modules.Chats.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class MarkChatReadCommandHandler(IChatRepository chatRepository, IUnitOfWork unitOfWork)
    : ICommandHandler<MarkChatReadCommand>
{
    public async Task<Result> Handle(MarkChatReadCommand command, CancellationToken ct)
    {
        var chat = await chatRepository.GetByIdAsync(ChatId.From(command.ChatId), ct);
        if (chat is null) return Result.Failure(Error.NotFound("Chat"));

        var result = chat.MarkMemberAsRead(command.RequesterId);
        if (result.IsFailure) return result;

        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }
}

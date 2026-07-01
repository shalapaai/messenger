namespace Messenger.Modules.Chats.Application.Contracts;

using Messenger.Shared.Kernel.Results;

// Публичный API модуля для межмодульного взаимодействия.
// Realtime вызывает этот интерфейс — не зависит от внутренностей модуля.
public interface IChatsModule
{
    Task<Result<List<Guid>>> GetChatIdsByUserIdAsync(Guid userId, CancellationToken ct = default);
    Task<Result<List<Guid>>> GetMemberIdsAsync(Guid chatId, CancellationToken ct = default);
}

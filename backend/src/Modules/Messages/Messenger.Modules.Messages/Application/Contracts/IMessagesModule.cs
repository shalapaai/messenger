namespace Messenger.Modules.Messages.Application.Contracts;

using Messenger.Shared.Kernel.Results;

public sealed record LastMessageDto(
    Guid     MessageId,
    Guid     SenderId,
    string   Content,
    DateTime SentAt);

// Публичный API модуля для межмодульного взаимодействия.
// Chats или Notifications вызывают этот интерфейс — не зависят от внутренностей модуля.
public interface IMessagesModule
{
    Task<Result<int>>                          GetMessageCountInChatAsync(Guid chatId, CancellationToken ct = default);
    Task<Result>                               DeleteAllMessagesInChatAsync(Guid chatId, CancellationToken ct = default);
    Task<Result<Dictionary<Guid, LastMessageDto>>> GetLastMessagesByChatIdsAsync(IReadOnlyList<Guid> chatIds, CancellationToken ct = default);
}

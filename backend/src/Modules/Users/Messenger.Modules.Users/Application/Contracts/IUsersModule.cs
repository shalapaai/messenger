namespace Messenger.Modules.Users.Application.Contracts;

using Messenger.Shared.Kernel.Results;

public sealed record UserSummaryDto(
    Guid    AuthUserId,
    string  DisplayName,
    string? AvatarUrl,
    string  AvatarColor);

// Публичный API модуля для межмодульного взаимодействия.
// Chats вызывает этот интерфейс — не зависит от внутренностей модуля.
public interface IUsersModule
{
    Task<Result<Dictionary<Guid, UserSummaryDto>>> GetSummariesByAuthUserIdsAsync(
        IReadOnlyList<Guid> authUserIds, CancellationToken ct = default);
}

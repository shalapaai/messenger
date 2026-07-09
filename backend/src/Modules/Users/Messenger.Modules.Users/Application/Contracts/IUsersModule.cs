namespace Messenger.Modules.Users.Application.Contracts;

using Messenger.Shared.Kernel.Results;

public sealed record UserSummaryDto(
    Guid    AuthUserId,
    string  DisplayName,
    string? AvatarUrl,
    string  AvatarColor);

public interface IUsersModule
{
    Task<Result<Dictionary<Guid, UserSummaryDto>>> GetSummariesByAuthUserIdsAsync(
        IReadOnlyList<Guid> authUserIds, CancellationToken ct = default);
}

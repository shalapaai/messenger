namespace Messenger.Modules.Users.Application.Features.GetMe;

using Messenger.Modules.Users.Application.Abstractions;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class GetMeQueryHandler(IUserProfileRepository repository)
    : IQueryHandler<GetMeQuery, MeDto>
{
    public async Task<Result<MeDto>> Handle(GetMeQuery query, CancellationToken ct)
    {
        var profile = await repository.GetByAuthUserIdAsync(query.AuthUserId, ct);
        if (profile is null)
            return Result.Failure<MeDto>(Error.NotFound("UserProfile"));

        return Result.Success(new MeDto(
            profile.AuthUserId,
            profile.Email,
            profile.DisplayName,
            profile.Login is not null ? $"@{profile.Login}" : null,
            profile.Status,
            profile.AvatarUrl,
            profile.Phone,
            profile.City,
            profile.Department,
            profile.CreatedAt,
            profile.UpdatedAt));
    }
}

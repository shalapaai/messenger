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
            query.Email,
            profile.Username,
            profile.DisplayName,
            profile.Status,
            profile.AvatarUrl,
            profile.CreatedAt,
            profile.UpdatedAt));
    }
}

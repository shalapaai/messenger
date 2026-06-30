namespace Messenger.Modules.Users.Application.Features.GetUserById;

using Messenger.Modules.Users.Application.Abstractions;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class GetUserByIdQueryHandler(IUserProfileRepository repository)
    : IQueryHandler<GetUserByIdQuery, PublicUserDto>
{
    public async Task<Result<PublicUserDto>> Handle(GetUserByIdQuery query, CancellationToken ct)
    {
        var profile = await repository.GetByAuthUserIdAsync(query.TargetUserId, ct);
        if (profile is null)
            return Result.Failure<PublicUserDto>(Error.NotFound("UserProfile"));

        return Result.Success(new PublicUserDto(
            profile.AuthUserId,
            profile.DisplayName,
            profile.Login is not null ? $"@{profile.Login}" : null,
            profile.Status,
            profile.AvatarUrl,
            profile.AvatarColor,
            profile.Phone,
            profile.City,
            profile.Department,
            profile.Email));
    }
}

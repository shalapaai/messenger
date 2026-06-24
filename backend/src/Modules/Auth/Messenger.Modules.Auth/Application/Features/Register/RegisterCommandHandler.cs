namespace Messenger.Modules.Auth.Application.Features.Register;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class RegisterCommandHandler(
    IUserAuthRepository userRepository,
    IPasswordHasher passwordHasher,
    IUnitOfWork unitOfWork)
    : ICommandHandler<RegisterCommand, UserAuthDto>
{
    public async Task<Result<UserAuthDto>> Handle(RegisterCommand command, CancellationToken ct)
    {
        var emailExists = await userRepository.ExistsByEmailAsync(command.Email, ct);
        if (emailExists)
            return Result.Failure<UserAuthDto>(Error.Conflict("Auth.EmailAlreadyExists"));

        var passwordHash = passwordHasher.Hash(command.Password);
        var userResult   = UserAuth.Create(command.Email, passwordHash);

        if (userResult.IsFailure)
            return Result.Failure<UserAuthDto>(userResult.Error);

        var user = userResult.Value!;
        userRepository.Add(user);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(new UserAuthDto(user.Id, user.Email, user.CreatedAt));
    }
}

namespace Messenger.Modules.Auth.Application.Features.Register;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Domain;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Results;

public sealed class RegisterCommandHandler(
    IUserAuthRepository userRepository,
    IPasswordHasher passwordHasher,
    IUnitOfWork unitOfWork)
    : ICommandHandler<RegisterCommand>
{
    public async Task<Result> Handle(RegisterCommand command, CancellationToken ct)
    {
        var emailExists = await userRepository.ExistsByEmailAsync(command.Email, ct);
        if (emailExists)
            return Result.Failure(Error.Conflict("Auth.EmailAlreadyExists"));

        var passwordHash = passwordHasher.Hash(command.Password);
        var userResult   = UserAuth.Create(command.Email, passwordHash);

        if (userResult.IsFailure)
            return Result.Failure(userResult.Error);

        userRepository.Add(userResult.Value!);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }
}

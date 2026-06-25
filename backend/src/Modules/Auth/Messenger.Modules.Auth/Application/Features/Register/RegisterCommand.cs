namespace Messenger.Modules.Auth.Application.Features.Register;

using Messenger.Shared.Kernel.Abstractions;

public sealed record RegisterCommand(string Email, string Password) : ICommand<UserAuthDto>;

public sealed record UserAuthDto(Guid Id, string Email, DateTime CreatedAt);

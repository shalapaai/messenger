namespace Messenger.Modules.Auth.Application.Features.Register;

using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Shared.Kernel.Abstractions;

public sealed record RegisterCommand(string Email, string Password) : ICommand<LoginResultDto>;

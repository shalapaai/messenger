namespace Messenger.Modules.Auth.Application.Features.ResetPassword;

using Messenger.Shared.Kernel.Abstractions;

public sealed record ResetPasswordCommand(string Email, string Code, string NewPassword) : ICommand;

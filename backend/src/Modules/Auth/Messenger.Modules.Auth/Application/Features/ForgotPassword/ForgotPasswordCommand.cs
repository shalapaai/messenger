namespace Messenger.Modules.Auth.Application.Features.ForgotPassword;

using Messenger.Shared.Kernel.Abstractions;

public sealed record ForgotPasswordCommand(string Email) : ICommand;

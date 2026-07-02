namespace Messenger.Modules.Auth.Application.Features.VerifyOtp;

using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Shared.Kernel.Abstractions;

public sealed record VerifyOtpCommand(string Email, string Code) : ICommand<TokenPairDto>;

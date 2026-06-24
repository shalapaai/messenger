namespace Messenger.Modules.Auth.Application.Features.RefreshToken;

using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Shared.Kernel.Abstractions;

public sealed record RefreshTokenCommand(string Token) : ICommand<TokenPairDto>;

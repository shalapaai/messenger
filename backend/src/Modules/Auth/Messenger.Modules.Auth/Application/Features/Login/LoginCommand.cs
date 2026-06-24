namespace Messenger.Modules.Auth.Application.Features.Login;

using Messenger.Shared.Kernel.Abstractions;

public sealed record LoginCommand(string Email, string Password) : ICommand<TokenPairDto>;

public sealed record TokenPairDto(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt);

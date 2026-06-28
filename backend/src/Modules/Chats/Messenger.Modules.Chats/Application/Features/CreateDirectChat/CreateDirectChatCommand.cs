namespace Messenger.Modules.Chats.Application.Features.CreateDirectChat;

using Messenger.Shared.Kernel.Abstractions;

public sealed record CreateDirectChatCommand(Guid CurrentUserId, Guid OtherUserId) : ICommand<Guid>;

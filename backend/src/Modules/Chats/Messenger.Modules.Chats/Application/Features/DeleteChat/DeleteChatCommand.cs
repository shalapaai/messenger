namespace Messenger.Modules.Chats.Application.Features.DeleteChat;

using Messenger.Shared.Kernel.Abstractions;

public sealed record DeleteChatCommand(Guid ChatId, Guid RequesterId) : ICommand;

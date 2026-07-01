namespace Messenger.Modules.Chats.Application.Features.MarkChatRead;

using Messenger.Shared.Kernel.Abstractions;

public sealed record MarkChatReadCommand(Guid ChatId, Guid RequesterId) : ICommand;

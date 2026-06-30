namespace Messenger.Modules.Messages.Application.Features.DeleteMessage;

using Messenger.Shared.Kernel.Abstractions;

public sealed record DeleteMessageCommand(Guid MessageId, Guid RequesterId) : ICommand;

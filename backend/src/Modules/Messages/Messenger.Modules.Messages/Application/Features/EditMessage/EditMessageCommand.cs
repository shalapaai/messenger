namespace Messenger.Modules.Messages.Application.Features.EditMessage;

using Messenger.Shared.Kernel.Abstractions;

public sealed record EditMessageCommand(Guid MessageId, Guid RequesterId, string NewContent) : ICommand;

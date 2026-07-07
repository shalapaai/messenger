namespace Messenger.Shared.Kernel.Abstractions;

using MediatR;
using Messenger.Shared.Kernel.Results;

// Commands — изменяют состояние, возвращают Result
public interface ICommand : IRequest<Result>;
public interface ICommand<TResponse> : IRequest<Result<TResponse>>;

// Queries — только чтение, без побочных эффектов
public interface IQuery<TResponse> : IRequest<Result<TResponse>>;

public interface ICommandHandler<TCommand> : IRequestHandler<TCommand, Result>
    where TCommand : ICommand;

public interface ICommandHandler<TCommand, TResponse> : IRequestHandler<TCommand, Result<TResponse>>
    where TCommand : ICommand<TResponse>;

public interface IQueryHandler<TQuery, TResponse> : IRequestHandler<TQuery, Result<TResponse>>
    where TQuery : IQuery<TResponse>;

namespace Messenger.Shared.Kernel.Extensions;

using Messenger.Shared.Kernel.Results;
using Microsoft.AspNetCore.Http;

public static class ResultExtensions
{
    public static IResult ToHttpResult(this Error error) => error.Type switch
    {
        ErrorType.NotFound      => Results.NotFound(new { error.Code, error.Description }),
        ErrorType.Unauthorized  => Results.Unauthorized(),
        ErrorType.Forbidden     => Results.Forbid(),
        ErrorType.Validation    => Results.UnprocessableEntity(new { error.Code, error.Description }),
        ErrorType.Conflict      => Results.Conflict(new { error.Code, error.Description }),
        _                       => Results.Problem(detail: error.Description, title: error.Code)
    };
}

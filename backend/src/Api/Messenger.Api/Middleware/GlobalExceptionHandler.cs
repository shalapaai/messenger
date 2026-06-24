namespace Messenger.Api.Middleware;

using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext ctx, Exception exception, CancellationToken ct)
    {
        if (exception is ValidationException validationEx)
        {
            var errors = validationEx.Errors
                .GroupBy(f => f.PropertyName, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(f => f.ErrorMessage).ToArray());

            ctx.Response.StatusCode = StatusCodes.Status422UnprocessableEntity;
            await ctx.Response.WriteAsJsonAsync(new
            {
                title  = "Validation failed",
                status = StatusCodes.Status422UnprocessableEntity,
                errors
            }, ct);

            return true;
        }

        logger.LogError(exception, "Unhandled exception: {Message}", exception.Message);

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title  = "Internal Server Error",
            Detail = ctx.RequestServices
                        .GetRequiredService<IHostEnvironment>()
                        .IsDevelopment()
                    ? exception.Message
                    : "An unexpected error occurred"
        };

        ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await ctx.Response.WriteAsJsonAsync(problem, ct);
        return true;
    }
}

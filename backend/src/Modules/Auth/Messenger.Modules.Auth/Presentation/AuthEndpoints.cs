namespace Messenger.Modules.Auth.Presentation;

using MediatR;
using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Modules.Localization.Resources;
using Messenger.Shared.Kernel.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Localization;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/login", Login)
            .WithName("Login")
            .Produces<TokenPairDto>()
            .ProducesValidationProblem()
            .AllowAnonymous();

        group.MapPost("/register", Register)
            .WithName("Register")
            .Produces(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .AllowAnonymous();

        group.MapPost("/refresh", RefreshToken)
            .WithName("RefreshToken")
            .Produces<TokenPairDto>()
            .AllowAnonymous();

        group.MapPost("/logout", Logout)
            .WithName("Logout")
            .Produces(StatusCodes.Status204NoContent)
            .RequireAuthorization();

        return app;
    }

    // Пример использования локализации: localizer["Auth.InvalidCredentials"]
    // возвращает текст на языке из Accept-Language заголовка
    private static async Task<IResult> Login(
        LoginCommand command,
        ISender sender,
        IStringLocalizer<SharedMessages> localizer,
        CancellationToken ct)
    {
        var result = await sender.Send(command, ct);

        if (result.IsFailure)
        {
            // Переводим код ошибки в локализованное сообщение
            var localizedMessage = localizer[result.Error.Code].Value;
            return Results.UnprocessableEntity(new
            {
                code        = result.Error.Code,
                description = localizedMessage
            });
        }

        return Results.Ok(result.Value);
    }

    private static async Task<IResult> Register(
        RegisterRequest request,
        ISender sender,
        CancellationToken ct)
    {
        var command = new Application.Features.Register.RegisterCommand(
            request.Email, request.Password, request.DisplayName);
        var result = await sender.Send(command, ct);

        return result.IsSuccess ? Results.Created() : result.Error.ToHttpResult();
    }

    private static async Task<IResult> RefreshToken(
        RefreshTokenRequest request,
        ISender sender,
        CancellationToken ct)
    {
        var command = new Application.Features.RefreshToken.RefreshTokenCommand(request.Token);
        var result = await sender.Send(command, ct);

        return result.IsSuccess ? Results.Ok(result.Value) : result.Error.ToHttpResult();
    }

    private static IResult Logout() => Results.NoContent();
}

public sealed record RegisterRequest(string Email, string Password, string DisplayName);
public sealed record RefreshTokenRequest(string Token);

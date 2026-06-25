namespace Messenger.Modules.Auth.Presentation;

using MediatR;
using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Modules.Auth.Application.Features.Logout;
using Messenger.Modules.Auth.Application.Features.Register;
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

        group.MapPost("/register", Register)
            .WithName("Register")
            .WithSummary("Регистрация нового пользователя")
            .WithDescription("Создаёт аккаунт. Email должен быть уникальным, пароль — минимум 8 символов.")
            .Produces<UserAuthDto>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .AllowAnonymous();

        group.MapPost("/login", Login)
            .WithName("Login")
            .WithSummary("Аутентификация")
            .WithDescription("Возвращает пару токенов: access (15 мин) и refresh (7 дней).")
            .Produces<TokenPairDto>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .AllowAnonymous();

        group.MapPost("/refresh", RefreshToken)
            .WithName("RefreshToken")
            .WithSummary("Обновление access токена")
            .WithDescription("Принимает refresh токен, возвращает новую пару. Старый refresh токен инвалидируется (rotation).")
            .Produces<TokenPairDto>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .AllowAnonymous();

        group.MapPost("/logout", Logout)
            .WithName("Logout")
            .WithSummary("Выход из системы")
            .WithDescription("Инвалидирует refresh токен. Bearer-токен не требуется — работает даже с истёкшим access токеном.")
            .Produces(StatusCodes.Status204NoContent)
            .AllowAnonymous();

        return app;
    }

    private static async Task<IResult> Register(
        RegisterRequest request,
        ISender sender,
        CancellationToken ct)
    {
        var command = new RegisterCommand(request.Email, request.Password);
        var result  = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.Created($"/api/users/{result.Value!.Id}", result.Value)
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> Login(
        LoginCommand command,
        ISender sender,
        IStringLocalizer<SharedMessages> localizer,
        CancellationToken ct)
    {
        var result = await sender.Send(command, ct);

        if (result.IsFailure)
        {
            var message = localizer[result.Error.Code].ResourceNotFound
                ? result.Error.Description
                : localizer[result.Error.Code].Value;
            return Results.UnprocessableEntity(new { code = result.Error.Code, description = message });
        }

        return Results.Ok(result.Value);
    }

    private static async Task<IResult> RefreshToken(
        RefreshTokenRequest request,
        ISender sender,
        CancellationToken ct)
    {
        var command = new Application.Features.RefreshToken.RefreshTokenCommand(request.Token);
        var result  = await sender.Send(command, ct);

        return result.IsSuccess ? Results.Ok(result.Value) : result.Error.ToHttpResult();
    }

    private static async Task<IResult> Logout(
        LogoutRequest request,
        ISender sender,
        CancellationToken ct)
    {
        await sender.Send(new LogoutCommand(request.RefreshToken), ct);
        return Results.NoContent();
    }
}

public sealed record RegisterRequest(string Email, string Password);
public sealed record RefreshTokenRequest(string Token);
public sealed record LogoutRequest(string RefreshToken);

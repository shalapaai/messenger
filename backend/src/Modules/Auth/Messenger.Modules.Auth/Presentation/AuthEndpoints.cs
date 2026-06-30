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
using Microsoft.Extensions.Hosting;

public static class AuthEndpoints
{
    private const string RefreshTokenCookieName = "messenger_refresh_token";

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/register", Register)
            .WithName("Register")
            .WithSummary("Регистрация нового пользователя")
            .WithDescription("Создаёт аккаунт, возвращает access токен и устанавливает refresh токен в HttpOnly cookie.")
            .Produces<TokenPairDto>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .AllowAnonymous();

        group.MapPost("/login", Login)
            .WithName("Login")
            .WithSummary("Аутентификация")
            .WithDescription("Возвращает access токен и устанавливает refresh токен в HttpOnly cookie.")
            .Produces<TokenPairDto>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .AllowAnonymous();

        group.MapPost("/refresh", RefreshToken)
            .WithName("RefreshToken")
            .WithSummary("Обновление access токена")
            .WithDescription("Читает refresh токен из HttpOnly cookie, возвращает новый access токен и обновляет refresh cookie.")
            .Produces<TokenPairDto>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .AllowAnonymous();

        group.MapPost("/logout", Logout)
            .WithName("Logout")
            .WithSummary("Выход из системы")
            .WithDescription("Инвалидирует refresh токен из cookie и удаляет refresh cookie. Bearer-токен не требуется.")
            .Produces(StatusCodes.Status204NoContent)
            .AllowAnonymous();

        return app;
    }

    private static async Task<IResult> Register(
        RegisterRequest request,
        ISender sender,
        HttpContext httpContext,
        IHostEnvironment environment,
        CancellationToken ct)
    {
        var command = new RegisterCommand(request.Email, request.Password);
        var result  = await sender.Send(command, ct);

        if (result.IsFailure)
        {
            return result.Error.ToHttpResult();
        }

        var tokens = result.Value!;
        AppendRefreshTokenCookie(httpContext.Response, tokens.RefreshToken, environment);
        return Results.Created("/api/auth/register", tokens);
    }

    private static async Task<IResult> Login(
        LoginCommand command,
        ISender sender,
        IStringLocalizer<SharedMessages> localizer,
        HttpContext httpContext,
        IHostEnvironment environment,
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

        var tokens = result.Value!;
        AppendRefreshTokenCookie(httpContext.Response, tokens.RefreshToken, environment);
        return Results.Ok(tokens);
    }

    private static async Task<IResult> RefreshToken(
        RefreshTokenRequest? request,
        ISender sender,
        HttpContext httpContext,
        IHostEnvironment environment,
        CancellationToken ct)
    {
        var refreshToken = httpContext.Request.Cookies[RefreshTokenCookieName] ?? request?.Token;
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return Results.Unauthorized();
        }
        var command = new Application.Features.RefreshToken.RefreshTokenCommand(refreshToken);
        var result  = await sender.Send(command, ct);

        if (result.IsFailure)
        {
            return result.Error.ToHttpResult();
        }

        var tokens = result.Value!;
        AppendRefreshTokenCookie(httpContext.Response, tokens.RefreshToken, environment);
        return Results.Ok(tokens);
    }

    private static async Task<IResult> Logout(
        LogoutRequest? request,
        ISender sender,
        HttpContext httpContext,
        IHostEnvironment environment,
        CancellationToken ct)
    {
        var refreshToken = httpContext.Request.Cookies[RefreshTokenCookieName] ?? request?.RefreshToken;
        if (!string.IsNullOrWhiteSpace(refreshToken))
        {
            await sender.Send(new LogoutCommand(refreshToken), ct);
        }
        DeleteRefreshTokenCookie(httpContext.Response, environment);
        return Results.NoContent();
    }

    private static void AppendRefreshTokenCookie(
        HttpResponse response,
        string refreshToken,
        IHostEnvironment environment)
    {
        response.Cookies.Append(
            RefreshTokenCookieName,
            refreshToken,
            CreateRefreshTokenCookieOptions(environment, DateTimeOffset.UtcNow.AddDays(7)));
    }

    private static void DeleteRefreshTokenCookie(HttpResponse response, IHostEnvironment environment)
    {
        response.Cookies.Delete(
            RefreshTokenCookieName,
            CreateRefreshTokenCookieOptions(environment));
    }

    private static CookieOptions CreateRefreshTokenCookieOptions(
        IHostEnvironment environment,
        DateTimeOffset? expires = null)
    {
        return new CookieOptions
        {
            HttpOnly = true,
            Secure = !environment.IsDevelopment(),
            SameSite = environment.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.None,
            Expires = expires,
            Path = "/api/auth"
        };
    }
}

public sealed record RegisterRequest(string Email, string Password);
public sealed record RefreshTokenRequest(string Token);
public sealed record LogoutRequest(string RefreshToken);

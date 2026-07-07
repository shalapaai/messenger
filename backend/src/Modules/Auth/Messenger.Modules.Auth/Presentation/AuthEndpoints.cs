namespace Messenger.Modules.Auth.Presentation;

using MediatR;
using Messenger.Modules.Auth.Application.Features.ForgotPassword;
using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Modules.Auth.Application.Features.Logout;
using Messenger.Modules.Auth.Application.Features.Register;
using Messenger.Modules.Auth.Application.Features.ResetPassword;
using Messenger.Modules.Auth.Application.Features.VerifyOtp;
using Messenger.Modules.Localization.Resources;
using Messenger.Shared.Kernel.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Hosting;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapGet("/features", GetFeatures)
            .WithName("GetAuthFeatures")
            .WithSummary("Публичные флаги фич")
            .Produces<AuthFeaturesDto>()
            .AllowAnonymous();

        group.MapPost("/register", Register)
            .WithName("Register")
            .WithSummary("Регистрация нового пользователя")
            .Produces<TokenPairDto>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .RequireRateLimiting("auth")
            .AllowAnonymous();

        group.MapPost("/login", Login)
            .WithName("Login")
            .WithSummary("Аутентификация")
            .WithDescription("Если 2FA включена — возвращает { requiresOtp: true }. Иначе — токены.")
            .Produces<LoginResultDto>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .RequireRateLimiting("auth")
            .AllowAnonymous();

        // "auth-strict" — узкое окно: и OTP, и код сброса пароля — короткие цифровые
        // секреты, которые иначе можно перебрать за разумное время без троттлинга
        group.MapPost("/verify-otp", VerifyOtp)
            .WithName("VerifyOtp")
            .WithSummary("Подтверждение кода из письма")
            .WithDescription("Принимает email + 6-значный код, при успехе выдаёт токены.")
            .Produces<TokenPairDto>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .RequireRateLimiting("auth-strict")
            .AllowAnonymous();

        group.MapPost("/refresh", RefreshToken)
            .WithName("RefreshToken")
            .WithSummary("Обновление access токена")
            .Produces<TokenPairDto>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .RequireRateLimiting("auth")
            .AllowAnonymous();

        group.MapPost("/logout", Logout)
            .WithName("Logout")
            .WithSummary("Выход из системы")
            .Produces(StatusCodes.Status204NoContent)
            .AllowAnonymous();

        group.MapPost("/forgot-password", ForgotPassword)
            .WithName("ForgotPassword")
            .WithSummary("Запрос кода сброса пароля")
            .WithDescription("Отправляет код на email. Всегда возвращает 200, даже если email не найден.")
            .Produces(StatusCodes.Status200OK)
            .RequireRateLimiting("auth-strict")
            .AllowAnonymous();

        group.MapPost("/reset-password", ResetPassword)
            .WithName("ResetPassword")
            .WithSummary("Сброс пароля по коду")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .RequireRateLimiting("auth-strict")
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
            return result.Error.ToHttpResult();

        var dto = result.Value!;

        if (dto.RequiresOtp)
            return Results.Accepted(value: dto);

        RefreshTokenCookie.Append(httpContext.Response, dto.RefreshToken!, environment);
        return Results.Created("/api/auth/register", dto);
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

        var dto = result.Value!;

        if (dto.RequiresOtp)
            return Results.Accepted(value: dto);

        RefreshTokenCookie.Append(httpContext.Response, dto.RefreshToken!, environment);
        return Results.Ok(dto);
    }

    private static async Task<IResult> VerifyOtp(
        VerifyOtpRequest request,
        ISender sender,
        HttpContext httpContext,
        IHostEnvironment environment,
        CancellationToken ct)
    {
        var command = new VerifyOtpCommand(request.Email, request.Code);
        var result  = await sender.Send(command, ct);

        if (result.IsFailure)
            return result.Error.ToHttpResult();

        var tokens = result.Value!;
        RefreshTokenCookie.Append(httpContext.Response, tokens.RefreshToken, environment);
        return Results.Ok(tokens);
    }

    private static async Task<IResult> RefreshToken(
        RefreshTokenRequest? request,
        ISender sender,
        HttpContext httpContext,
        IHostEnvironment environment,
        CancellationToken ct)
    {
        var refreshToken = httpContext.Request.Cookies[RefreshTokenCookie.Name] ?? request?.Token;
        if (string.IsNullOrWhiteSpace(refreshToken))
            return Results.Unauthorized();

        var command = new Application.Features.RefreshToken.RefreshTokenCommand(refreshToken);
        var result  = await sender.Send(command, ct);

        if (result.IsFailure)
        {
            // Токен из cookie стал невалиден (истёк, отозван, либо — типичное дело в dev —
            // база пересоздана и такой строки в refresh_token больше нет). Сама эта cookie
            // httpOnly, клиент не может стереть её через JS, поэтому без явного Delete здесь
            // она осталась бы в браузере навсегда и каждый следующий /refresh падал бы с той
            // же ошибкой, пока пользователь не почистит cookies вручную.
            RefreshTokenCookie.Delete(httpContext.Response, environment);
            return result.Error.ToHttpResult();
        }

        var tokens = result.Value!;
        RefreshTokenCookie.Append(httpContext.Response, tokens.RefreshToken, environment);
        return Results.Ok(tokens);
    }

    private static async Task<IResult> Logout(
        LogoutRequest? request,
        ISender sender,
        HttpContext httpContext,
        IHostEnvironment environment,
        CancellationToken ct)
    {
        var refreshToken = httpContext.Request.Cookies[RefreshTokenCookie.Name] ?? request?.RefreshToken;
        if (!string.IsNullOrWhiteSpace(refreshToken))
            await sender.Send(new LogoutCommand(refreshToken), ct);

        RefreshTokenCookie.Delete(httpContext.Response, environment);
        return Results.NoContent();
    }

    private static IResult GetFeatures(IConfiguration configuration)
    {
        return Results.Ok(new AuthFeaturesDto(
            PasswordResetEnabled: configuration.GetValue<bool>("PasswordReset:Enabled"),
            TwoFactorEnabled:     configuration.GetValue<bool>("TwoFactor:Enabled")));
    }

    private static async Task<IResult> ForgotPassword(
        ForgotPasswordRequest request,
        ISender sender,
        CancellationToken ct)
    {
        await sender.Send(new ForgotPasswordCommand(request.Email), ct);
        return Results.Ok();
    }

    private static async Task<IResult> ResetPassword(
        ResetPasswordRequest request,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender.Send(new ResetPasswordCommand(request.Email, request.Code, request.NewPassword), ct);

        if (result.IsFailure)
            return result.Error.ToHttpResult();

        return Results.NoContent();
    }
}

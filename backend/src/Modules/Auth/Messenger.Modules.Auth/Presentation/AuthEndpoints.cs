namespace Messenger.Modules.Auth.Presentation;

using MediatR;
using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Shared.Kernel.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/login", Login)
            .WithName("Login")
            .Produces<TokenPairDto>()
            .AllowAnonymous();

        group.MapPost("/register", Register)
            .WithName("Register")
            .Produces(StatusCodes.Status201Created)
            .AllowAnonymous();

        group.MapPost("/refresh", RefreshToken)
            .WithName("RefreshToken")
            .Produces<TokenPairDto>()
            .AllowAnonymous();

        group.MapPost("/logout", Logout)
            .WithName("Logout")
            .RequireAuthorization();

        return app;
    }

    private static async Task<IResult> Login(LoginCommand command, ISender sender, CancellationToken ct)
    {
        var result = await sender.Send(command, ct);
        return result.IsSuccess ? Results.Ok(result.Value) : result.Error.ToHttpResult();
    }

    private static async Task<IResult> Register(
        RegisterRequest request, ISender sender, CancellationToken ct)
    {
        var command = new Application.Features.Register.RegisterCommand(request.Email, request.Password, request.DisplayName);
        var result = await sender.Send(command, ct);
        return result.IsSuccess ? Results.Created() : result.Error.ToHttpResult();
    }

    private static async Task<IResult> RefreshToken(
        RefreshTokenRequest request, ISender sender, CancellationToken ct)
    {
        var command = new Application.Features.RefreshToken.RefreshTokenCommand(request.Token);
        var result = await sender.Send(command, ct);
        return result.IsSuccess ? Results.Ok(result.Value) : result.Error.ToHttpResult();
    }

    private static IResult Logout(HttpContext ctx)
    {
        // Refresh token revocation — упрощено для примера
        return Results.NoContent();
    }
}

public sealed record RegisterRequest(string Email, string Password, string DisplayName);
public sealed record RefreshTokenRequest(string Token);

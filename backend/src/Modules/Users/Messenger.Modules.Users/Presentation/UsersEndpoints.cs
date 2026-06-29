namespace Messenger.Modules.Users.Presentation;

using MediatR;
using Messenger.Modules.Users.Application.Features.CreateUserProfile;
using Messenger.Modules.Users.Application.Features.GetMe;
using Messenger.Modules.Users.Application.Features.SearchUsers;
using Messenger.Modules.Users.Application.Features.UpdateUserProfile;
using Messenger.Modules.Users.Application.Features.UploadAvatar;
using Messenger.Shared.Kernel.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

public static class UsersEndpoints
{
    public static IEndpointRouteBuilder MapUsersEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users").WithTags("Users").RequireAuthorization();

        group.MapPost("/", CreateProfile)
            .WithName("CreateUserProfile")
            .WithSummary("Создать профиль пользователя")
            .WithDescription(
                "Создаёт профиль для авторизованного пользователя. " +
                "Email берётся из JWT-токена. " +
                "Поле `login` — опциональный уникальный логин в формате `@login` (3–30 символов: буквы, цифры, _); " +
                "передаётся без @, возвращается с @. " +
                "409 — профиль уже существует, email или login заняты.")
            .Produces<UserProfileDto>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);

        group.MapGet("/me", GetMe)
            .WithName("GetMe")
            .WithSummary("Получить свой профиль")
            .WithDescription("Возвращает полный профиль текущего пользователя. Поле `login` содержит @ или null, если логин не задан.")
            .Produces<MeDto>()
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPatch("/me", UpdateProfile)
            .WithName("UpdateUserProfile")
            .WithSummary("Обновить профиль")
            .WithDescription(
                "Частичное обновление: передавайте только изменяемые поля. " +
                "`login` — передаётся без @, возвращается с @; " +
                "409 если логин уже занят другим пользователем.")
            .Produces<UpdatedProfileDto>()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/me/avatar", UploadAvatar)
            .WithName("UploadUserAvatar")
            .WithSummary("Загрузить аватар")
            .WithDescription("Принимает `multipart/form-data`, поле `file`. Максимальный размер — 5 МБ. Поддерживаются JPEG, PNG, WebP.")
            .Produces<AvatarUrlDto>()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .DisableAntiforgery();

        group.MapGet("/search", SearchUsers)
            .WithName("SearchUsers")
            .WithSummary("Поиск пользователей")
            .WithDescription(
                "Поиск по email, displayName и login. " +
                "Если `q` начинается с `@` — поиск только по полю login (например, `@anna`). " +
                "Поддерживает пагинацию: `page` (default 1), `pageSize` (default 20, max 50). " +
                "Текущий пользователь исключается из результатов.")
            .Produces<SearchResultDto>()
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);

        return app;
    }

    private static async Task<IResult> CreateProfile(
        CreateUserProfileRequest request,
        ISender sender,
        HttpContext ctx,
        CancellationToken ct)
    {
        var command = new CreateUserProfileCommand(ctx.GetUserId(), ctx.GetUserEmail(), request.DisplayName, request.Login);
        var result  = await sender.Send(command, ct);
        return result.IsSuccess
            ? Results.Created($"/api/users/{result.Value!.UserId}", result.Value)
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> GetMe(ISender sender, HttpContext ctx, CancellationToken ct)
    {
        var result = await sender.Send(new GetMeQuery(ctx.GetUserId()), ct);
        return result.IsSuccess ? Results.Ok(result.Value) : result.Error.ToHttpResult();
    }

    private static async Task<IResult> UpdateProfile(
        UpdateUserProfileRequest request,
        ISender sender,
        HttpContext ctx,
        CancellationToken ct)
    {
        var command = new UpdateUserProfileCommand(ctx.GetUserId(), request.DisplayName, request.Status, request.Login, request.Phone, request.City, request.Department);
        var result  = await sender.Send(command, ct);
        return result.IsSuccess ? Results.Ok(result.Value) : result.Error.ToHttpResult();
    }

    private static async Task<IResult> UploadAvatar(
        IFormFile file,
        ISender sender,
        HttpContext ctx,
        CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        var command = new UploadUserAvatarCommand(
            ctx.GetUserId(), stream, file.FileName, file.ContentType, file.Length);
        var result = await sender.Send(command, ct);
        return result.IsSuccess ? Results.Ok(new AvatarUrlDto(result.Value!)) : result.Error.ToHttpResult();
    }

    private static async Task<IResult> SearchUsers(
        string q,
        ISender sender,
        HttpContext ctx,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Results.UnprocessableEntity(new { code = "Validation.Query", description = "Search query is required" });

        var query  = new SearchUsersQuery(ctx.GetUserId(), q, page, pageSize);
        var result = await sender.Send(query, ct);

        return result.IsSuccess
            ? Results.Ok(new SearchResultDto(
                result.Value!.Items, result.Value.TotalCount, result.Value.Page, result.Value.PageSize))
            : result.Error.ToHttpResult();
    }
}

public sealed record CreateUserProfileRequest(string DisplayName, string? Login);
public sealed record UpdateUserProfileRequest(string? DisplayName, string? Status, string? Login, string? Phone, string? City, string? Department);
public sealed record AvatarUrlDto(string AvatarUrl);
public sealed record SearchResultDto(
    IReadOnlyList<UserSearchResultDto> Items,
    int TotalCount,
    int Page,
    int PageSize);

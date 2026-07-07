namespace Messenger.Modules.Files.Presentation;

using MediatR;
using Messenger.Modules.Files.Application.Features.UploadAvatar;
using Messenger.Modules.Files.Domain;
using Messenger.Modules.Files.Infrastructure;
using Messenger.Shared.Kernel.Extensions;
using Messenger.Shared.Kernel.Membership;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

public static class FilesEndpoints
{
    public static IEndpointRouteBuilder MapFilesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/files").WithTags("Files");

        // Загрузка аватара
        group.MapPost("/avatar", UploadAvatar)
            .WithName("UploadAvatar")
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<AvatarUploadResponse>(StatusCodes.Status200OK)
            .DisableAntiforgery()
            .RequireRateLimiting("uploads")
            .RequireAuthorization();

        // Аватары публичные; вложения чатов проверяются внутри хендлера (маршрут анонимный, чтобы не ломать
        // аватарки). Catch-all (не просто {fileKey}) — у S3-ключей есть слэши (date-префикс папок), обычный
        // сегмент их бы не заматчил.
        group.MapGet("/{*fileKey}", DownloadFile)
            .WithName("DownloadFile")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .AllowAnonymous();

        return app;
    }

    private static async Task<IResult> UploadAvatar(
        IFormFile file,
        HttpContext ctx,
        ISender sender,
        CancellationToken ct)
    {
        if (file.Length == 0)
            return Results.BadRequest(new { error = "File is empty" });

        var userId = ctx.GetUserId();

        await using var stream = file.OpenReadStream();
        var command = new UploadAvatarCommand(userId, stream, file.FileName, file.ContentType, file.Length);
        var result  = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.Ok(new AvatarUploadResponse(result.Value!))
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> DownloadFile(
        string fileKey,
        HttpContext ctx,
        FilesDbContext dbContext,
        Application.Abstractions.IFileStorage fileStorage,
        IChatMembershipChecker membershipChecker,
        CancellationToken ct)
    {
        var record = await dbContext.FileUploads
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.FileKey == fileKey, ct);

        if (record is null)
            return Results.NotFound();

        if (record.Category == FileCategory.ChatAttachment)
        {
            if (ctx.User.Identity?.IsAuthenticated != true)
                return Results.StatusCode(StatusCodes.Status401Unauthorized);

            var userId = ctx.GetUserId();
            if (record.ChatId is null || !await membershipChecker.IsMemberAsync(record.ChatId.Value, userId, ct))
                return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        var stream = await fileStorage.DownloadAsync(fileKey, ct);
        return Results.Stream(stream, record.ContentType, record.OriginalName);
    }
}

public sealed record AvatarUploadResponse(string Url);

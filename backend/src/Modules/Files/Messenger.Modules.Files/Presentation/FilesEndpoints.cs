namespace Messenger.Modules.Files.Presentation;

using MediatR;
using Messenger.Modules.Files.Application.Features.UploadAvatar;
using Messenger.Modules.Files.Infrastructure;
using Messenger.Shared.Kernel.Extensions;
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
            .RequireAuthorization();

        // Скачивание файла (аватары, вложения)
        group.MapGet("/{fileKey}", DownloadFile)
            .WithName("DownloadFile")
            .Produces(StatusCodes.Status200OK)
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
        FilesDbContext dbContext,
        Application.Abstractions.IFileStorage fileStorage,
        CancellationToken ct)
    {
        var record = await dbContext.FileUploads
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.FileKey == fileKey, ct);

        if (record is null)
            return Results.NotFound();

        var stream = await fileStorage.DownloadAsync(fileKey, ct);
        return Results.Stream(stream, record.ContentType, record.OriginalName);
    }
}

public sealed record AvatarUploadResponse(string Url);

namespace Messenger.Modules.Messages.Presentation;

using MediatR;
using Messenger.Modules.Messages.Application.Features.DeleteMessage;
using Messenger.Modules.Messages.Application.Features.EditMessage;
using Messenger.Modules.Messages.Application.Features.ForwardMessages;
using Messenger.Modules.Messages.Application.Features.GetMessages;
using Messenger.Modules.Messages.Application.Features.SendMessage;
using Messenger.Modules.Messages.Application.Features.UploadAndSendMessage;
using Messenger.Shared.Kernel.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

public static class MessagesEndpoints
{
    public static IEndpointRouteBuilder MapMessagesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/chats/{chatId:guid}/messages")
            .WithTags("Messages")
            .RequireAuthorization();

        group.MapPost("/", SendMessage)
            .WithName("SendMessage")
            .Produces<Guid>(StatusCodes.Status201Created)
            .ProducesValidationProblem();

        group.MapGet("/", GetMessages)
            .WithName("GetMessages")
            .WithSummary("История сообщений чата")
            .WithDescription("Возвращает сообщения чата с cursor-пагинацией. Передай nextCursor из предыдущего ответа как before для загрузки следующей страницы.")
            .Produces<MessagesPageDto>();

        group.MapPost("/upload", UploadAndSendMessage)
            .WithName("UploadAndSendMessage")
            .WithSummary("Отправить файл/фото")
            .WithDescription("Загружает файл и отправляет его как сообщение. Поддерживает любые типы файлов до 20 МБ. Необязательное поле caption — подпись к файлу.")
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<Guid>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .DisableAntiforgery();

        group.MapPatch("/{messageId:guid}", EditMessage)
            .WithName("EditMessage")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem();

        group.MapDelete("/{messageId:guid}", DeleteMessage)
            .WithName("DeleteMessage")
            .WithSummary("Удалить сообщение")
            .WithDescription("Удаляет (soft-delete) сообщение. Доступно любому участнику чата.")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem();

        group.MapPost("/forward", ForwardMessages)
            .WithName("ForwardMessages")
            .WithSummary("Переслать сообщения в другой чат")
            .WithDescription("{chatId} в маршруте — целевой чат, куда пересылаем. sourceChatId в теле — чат-источник, откуда взяты messageIds.")
            .Produces<List<Guid>>(StatusCodes.Status201Created)
            .ProducesValidationProblem();

        return app;
    }

    private static async Task<IResult> SendMessage(
        Guid chatId,
        SendMessageRequest request,
        HttpContext httpContext,
        ISender sender,
        CancellationToken ct)
    {
        var userId = httpContext.GetUserId();
        var command = new SendMessageCommand(chatId, userId, request.Content, request.ReplyToMessageId);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.Created($"/api/chats/{chatId}/messages/{result.Value}", result.Value)
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> GetMessages(
        Guid              chatId,
        HttpContext       httpContext,
        ISender           sender,
        CancellationToken ct,
        Guid?             before = null,
        int               limit  = 50)
    {
        var userId = httpContext.GetUserId();
        var result = await sender.Send(new GetMessagesQuery(chatId, userId, before, limit), ct);

        return result.IsSuccess
            ? Results.Ok(result.Value)
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> UploadAndSendMessage(
        Guid              chatId,
        IFormFile         file,
        HttpContext        httpContext,
        ISender           sender,
        CancellationToken ct,
        string?           caption = null)
    {
        if (file is null || file.Length == 0)
            return Results.BadRequest(new { error = "File is empty" });

        var userId = httpContext.GetUserId();

        await using var stream = file.OpenReadStream();
        var command = new UploadAndSendMessageCommand(
            chatId, userId, stream, file.FileName, file.ContentType, file.Length, caption);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.Created($"/api/chats/{chatId}/messages/{result.Value}", result.Value)
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> EditMessage(
        Guid chatId,
        Guid messageId,
        EditMessageRequest request,
        HttpContext httpContext,
        ISender sender,
        CancellationToken ct)
    {
        var userId = httpContext.GetUserId();
        var command = new EditMessageCommand(messageId, userId, request.NewContent);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.NoContent()
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> DeleteMessage(
        Guid chatId,
        Guid messageId,
        HttpContext httpContext,
        ISender sender,
        CancellationToken ct)
    {
        var userId = httpContext.GetUserId();
        var command = new DeleteMessageCommand(messageId, userId);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.NoContent()
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> ForwardMessages(
        Guid chatId,
        ForwardMessagesRequest request,
        HttpContext httpContext,
        ISender sender,
        CancellationToken ct)
    {
        var userId = httpContext.GetUserId();
        var command = new ForwardMessagesCommand(request.MessageIds, request.SourceChatId, chatId, userId);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.Created($"/api/chats/{chatId}/messages", result.Value)
            : result.Error.ToHttpResult();
    }
}

public sealed record SendMessageRequest(string Content, Guid? ReplyToMessageId = null);
public sealed record EditMessageRequest(string NewContent);
public sealed record ForwardMessagesRequest(Guid SourceChatId, List<Guid> MessageIds);

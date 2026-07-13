namespace Messenger.Modules.Messages.Presentation;

using MediatR;
using Messenger.Modules.Messages.Application.Features.DeleteMessage;
using Messenger.Modules.Messages.Application.Features.DeleteMessages;
using Messenger.Modules.Messages.Application.Features.EditMessage;
using Messenger.Modules.Messages.Application.Features.ForwardMessages;
using Messenger.Modules.Messages.Application.Features.GetMessages;
using Messenger.Modules.Messages.Application.Features.SearchMessages;
using Messenger.Modules.Messages.Application.Features.SendMessage;
using Messenger.Modules.Messages.Application.Features.SetMessageReaction;
using Messenger.Modules.Messages.Application.Features.UploadAndSendMessage;
using Messenger.Shared.Kernel.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
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
            .ProducesValidationProblem()
            .RequireRateLimiting("messaging");

        group.MapGet("/", GetMessages)
            .WithName("GetMessages")
            .WithSummary("История сообщений чата")
            .WithDescription("Возвращает сообщения чата с cursor-пагинацией. Передай nextCursor из предыдущего ответа как before для загрузки следующей страницы.")
            .Produces<MessagesPageDto>();

        group.MapGet("/search", SearchMessages)
            .WithName("SearchMessages")
            .WithSummary("Поиск сообщений в чате по словам")
            .WithDescription("Ищет по совпадению слов (не по произвольной подстроке) — 'поход' найдёт 'походы', но не 'выход'.")
            .Produces<List<MessageSearchResultDto>>();

        group.MapPost("/upload", UploadAndSendMessage)
            .WithName("UploadAndSendMessage")
            .WithSummary("Отправить файл(ы)/фото")
            .WithDescription("Загружает один или несколько файлов и отправляет их одним сообщением. Изображения/документы/архивы/аудио/видео до 25 МБ каждый. Необязательное поле caption — подпись ко всему сообщению.")
            .Accepts<IFormFileCollection>("multipart/form-data")
            .Produces<UploadAndSendMessageResult>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .DisableAntiforgery()
            .RequireRateLimiting("uploads");

        group.MapPatch("/{messageId:guid}", EditMessage)
            .WithName("EditMessage")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem();

        group.MapPut("/{messageId:guid}/reaction", SetMessageReaction)
            .WithName("SetMessageReaction")
            .WithSummary("Поставить, заменить или убрать реакцию на сообщение")
            .WithDescription("Один пользователь может иметь только одну реакцию на сообщение. Передай emoji = null/empty, чтобы убрать реакцию.")
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
            .ProducesValidationProblem()
            .RequireRateLimiting("messaging");

        group.MapPost("/delete-bulk", DeleteMessages)
            .WithName("DeleteMessages")
            .WithSummary("Удалить несколько сообщений одним запросом")
            .WithDescription("Удаляет (soft-delete) все переданные сообщения этого чата одной командой вместо отдельного запроса на каждое.")
            .Produces<List<Guid>>(StatusCodes.Status200OK)
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

    private static async Task<IResult> SearchMessages(
        Guid              chatId,
        HttpContext       httpContext,
        ISender           sender,
        CancellationToken ct,
        string            q = "")
    {
        var userId = httpContext.GetUserId();
        var result = await sender.Send(new SearchMessagesQuery(chatId, userId, q), ct);

        return result.IsSuccess
            ? Results.Ok(result.Value)
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> UploadAndSendMessage(
        Guid              chatId,
        HttpContext       httpContext,
        ISender           sender,
        CancellationToken ct,
        [FromQuery] string? caption = null)
    {
        var form = await httpContext.Request.ReadFormAsync(ct);
        var files = form.Files;
        if (files.Count == 0)
            return Results.BadRequest(new { error = "No files provided" });

        var userId = httpContext.GetUserId();

        var streams = files.Select(f => f.OpenReadStream()).ToList();
        try
        {
            var uploadedFiles = files
                .Zip(streams, (f, s) => new UploadedFile(s, f.FileName, f.ContentType, f.Length))
                .ToList();
            var command = new UploadAndSendMessageCommand(chatId, userId, uploadedFiles, caption);
            var result = await sender.Send(command, ct);

            return result.IsSuccess
                ? Results.Created($"/api/chats/{chatId}/messages/{result.Value!.MessageId}", result.Value)
                : result.Error.ToHttpResult();
        }
        finally
        {
            foreach (var stream in streams)
                await stream.DisposeAsync();
        }
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

    private static async Task<IResult> SetMessageReaction(
        Guid chatId,
        Guid messageId,
        SetMessageReactionRequest request,
        HttpContext httpContext,
        ISender sender,
        CancellationToken ct)
    {
        var userId = httpContext.GetUserId();
        var command = new SetMessageReactionCommand(chatId, messageId, userId, request.Emoji);
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

    private static async Task<IResult> DeleteMessages(
        Guid chatId,
        DeleteMessagesRequest request,
        HttpContext httpContext,
        ISender sender,
        CancellationToken ct)
    {
        var userId = httpContext.GetUserId();
        var command = new DeleteMessagesCommand(chatId, request.MessageIds, userId);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.Ok(result.Value)
            : result.Error.ToHttpResult();
    }
}

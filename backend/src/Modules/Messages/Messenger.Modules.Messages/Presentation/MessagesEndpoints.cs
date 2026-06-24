namespace Messenger.Modules.Messages.Presentation;

using MediatR;
using Messenger.Modules.Messages.Application.Features.EditMessage;
using Messenger.Modules.Messages.Application.Features.GetMessages;
using Messenger.Modules.Messages.Application.Features.SendMessage;
using Messenger.Shared.Kernel.Extensions;
using Messenger.Shared.Kernel.Pagination;
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
            .Produces<PagedList<MessageDto>>();

        group.MapPatch("/{messageId:guid}", EditMessage)
            .WithName("EditMessage")
            .Produces(StatusCodes.Status204NoContent)
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
        Guid chatId,
        ISender sender,
        CancellationToken ct,
        int page = 1,
        int pageSize = 50)
    {
        var result = await sender.Send(new GetMessagesQuery(chatId, page, pageSize), ct);

        return result.IsSuccess
            ? Results.Ok(result.Value)
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
}

public sealed record SendMessageRequest(string Content, Guid? ReplyToMessageId = null);
public sealed record EditMessageRequest(string NewContent);

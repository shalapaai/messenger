namespace Messenger.Modules.Messages.Presentation;

using MediatR;
using Messenger.Modules.Messages.Application.Features.CreatePoll;
using Messenger.Modules.Messages.Application.Features.SetPollVote;
using Messenger.Shared.Kernel.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

public static class PollsEndpoints
{
    public static IEndpointRouteBuilder MapPollsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/chats/{chatId:guid}/polls")
            .WithTags("Polls")
            .RequireAuthorization();

        group.MapPost("/", CreatePoll)
            .WithName("CreatePoll")
            .WithSummary("Создать опрос в групповом чате")
            .WithDescription("Доступно только в групповых чатах.")
            .Produces<Guid>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .RequireRateLimiting("messaging");

        group.MapPut("/{messageId:guid}/vote", Vote)
            .WithName("VotePoll")
            .WithSummary("Проголосовать в опросе")
            .WithDescription("Повторный вызов с другим optionId меняет голос — один пользователь может выбрать только один вариант.")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem();

        group.MapDelete("/{messageId:guid}/vote", RetractVote)
            .WithName("RetractPollVote")
            .WithSummary("Отменить свой голос в опросе")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem();

        return app;
    }

    private static async Task<IResult> CreatePoll(
        Guid chatId,
        CreatePollRequest request,
        HttpContext httpContext,
        ISender sender,
        CancellationToken ct)
    {
        var userId = httpContext.GetUserId();
        var command = new CreatePollCommand(chatId, userId, request.Question, request.Options);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.Created($"/api/chats/{chatId}/messages/{result.Value}", result.Value)
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> Vote(
        Guid chatId,
        Guid messageId,
        SetPollVoteRequest request,
        HttpContext httpContext,
        ISender sender,
        CancellationToken ct)
    {
        var userId = httpContext.GetUserId();
        var command = new SetPollVoteCommand(chatId, messageId, userId, request.OptionId);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.NoContent()
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> RetractVote(
        Guid chatId,
        Guid messageId,
        HttpContext httpContext,
        ISender sender,
        CancellationToken ct)
    {
        var userId = httpContext.GetUserId();
        var command = new SetPollVoteCommand(chatId, messageId, userId, null);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.NoContent()
            : result.Error.ToHttpResult();
    }
}

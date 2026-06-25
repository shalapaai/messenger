namespace Messenger.Modules.Chats.Presentation;

using MediatR;
using Messenger.Modules.Chats.Application;
using Messenger.Shared.Kernel.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

public static class ChatsEndpoints
{
    public static IEndpointRouteBuilder MapChatsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/chats")
            .WithTags("Chats")
            .RequireAuthorization();

        group.MapPost("/direct", CreateDirectChat)
            .WithName("CreateDirectChat")
            .WithSummary("Create or get existing direct chat with a user")
            .Produces<Guid>(StatusCodes.Status200OK)
            .ProducesValidationProblem();

        return app;
    }

    private static async Task<IResult> CreateDirectChat(
        CreateDirectChatRequest request,
        HttpContext httpContext,
        ISender sender,
        CancellationToken ct)
    {
        var currentUserId = httpContext.GetUserId();
        var command = new CreateDirectChatCommand(currentUserId, request.OtherUserId);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.Ok(result.Value)
            : result.Error.ToHttpResult();
    }
}

public sealed record CreateDirectChatRequest(Guid OtherUserId);
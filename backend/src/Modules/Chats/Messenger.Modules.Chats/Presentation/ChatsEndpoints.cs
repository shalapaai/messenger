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
            .WithSummary("Создание / получение существующего чата с юзером")
            .WithDescription("Создаёт личный чат между текущим пользователем и указанным. " +
                             "Если чат уже существует — возвращает его ID без создания дубликата (идемпотентная операция).")
            .Produces<Guid>(StatusCodes.Status200OK)
            .ProducesValidationProblem();

        group.MapPost("/group", CreateGroupChat)
            .WithName("CreateGroupChat")
            .WithSummary("Создание группового чата")
            .WithDescription("Создаёт новый групповой чат с заданным именем. " +
                             "Текущий пользователь становится владельцем (Owner), переданные участники добавляются с ролью Member.")
            .Produces<Guid>(StatusCodes.Status201Created)
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
    private static async Task<IResult> CreateGroupChat(
        CreateGroupChatRequest request,
        HttpContext            httpContext,
        ISender                sender,
        CancellationToken      ct)
    {
        var creatorId = httpContext.GetUserId();
        var command   = new CreateGroupChatCommand(creatorId, request.Name, request.MemberIds ?? []);
        var result    = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.Created($"/api/chats/{result.Value}", result.Value)
            : result.Error.ToHttpResult();
    }
}

public sealed record CreateDirectChatRequest(Guid OtherUserId);
public sealed record CreateGroupChatRequest(string Name, List<Guid>? MemberIds);
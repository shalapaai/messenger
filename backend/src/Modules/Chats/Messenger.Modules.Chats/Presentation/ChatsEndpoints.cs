namespace Messenger.Modules.Chats.Presentation;

using MediatR;
using Messenger.Modules.Chats.Application.Features.AddChatMember;
using Messenger.Modules.Chats.Application.Features.CreateDirectChat;
using Messenger.Modules.Chats.Application.Features.CreateGroupChat;
using Messenger.Modules.Chats.Application.Features.DeleteChat;
using Messenger.Modules.Chats.Application.Features.RemoveChatMember;
using Messenger.Modules.Chats.Application.Features.UpdateChat;
using Messenger.Modules.Chats.Application.Features.GetChatById;
using Messenger.Modules.Chats.Application.Features.GetChats;
using Messenger.Modules.Chats.Application.Features.MarkChatRead;
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

        group.MapGet("", GetChats)
            .WithName("GetChats")
            .WithSummary("Список чатов текущего пользователя")
            .WithDescription("Возвращает все чаты пользователя с последним сообщением в каждом, отсортированные по дате последнего сообщения.")
            .Produces<List<ChatSummaryDto>>(StatusCodes.Status200OK);

        group.MapGet("/{id:guid}", GetChatById)
            .WithName("GetChatById")
            .WithSummary("Информация о чате")
            .WithDescription("Возвращает детальную информацию о чате и список его участников. Доступно только участникам чата.")
            .Produces<ChatDetailDto>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPost("/{id:guid}/members", AddChatMember)
            .WithName("AddChatMember")
            .WithSummary("Добавить участника в групповой чат")
            .WithDescription("Добавляет пользователя в групповой чат. Доступно только участникам чата. Для личных чатов недоступно.")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapDelete("/{id:guid}/members/{userId:guid}", RemoveChatMember)
            .WithName("RemoveChatMember")
            .WithSummary("Удалить участника / выйти из группы")
            .WithDescription("Удаляет участника из группового чата. Любой участник может выйти сам. Удалить другого может только Admin или Owner. Owner не может быть удалён.")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPatch("/{id:guid}", UpdateChat)
            .WithName("UpdateChat")
            .WithSummary("Обновить название / аватарку группы")
            .WithDescription("Обновляет название и/или аватарку группового чата. Доступно только Admin и Owner. Передавай только те поля которые хочешь изменить.")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapDelete("/{id:guid}", DeleteChat)
            .WithName("DeleteChat")
            .WithSummary("Удалить личный чат")
            .WithDescription("Полностью удаляет личный (direct) чат вместе со всеми сообщениями — для обоих участников. " +
                             "Для групповых чатов используй выход из группы (DELETE /chats/{id}/members/{userId}).")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesValidationProblem();

        group.MapPost("/{id:guid}/read", MarkChatRead)
            .WithName("MarkChatRead")
            .WithSummary("Отметить чат прочитанным")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status404NotFound);

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

    private static async Task<IResult> GetChats(
        HttpContext       httpContext,
        ISender           sender,
        CancellationToken ct)
    {
        var currentUserId = httpContext.GetUserId();
        var result = await sender.Send(new GetChatsQuery(currentUserId), ct);

        return result.IsSuccess
            ? Results.Ok(result.Value)
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> GetChatById(
        Guid              id,
        HttpContext        httpContext,
        ISender            sender,
        CancellationToken  ct)
    {
        var currentUserId = httpContext.GetUserId();
        var result = await sender.Send(new GetChatByIdQuery(id, currentUserId), ct);

        return result.IsSuccess
            ? Results.Ok(result.Value)
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> AddChatMember(
        Guid                   id,
        AddChatMemberRequest   request,
        HttpContext            httpContext,
        ISender                sender,
        CancellationToken      ct)
    {
        var requesterId = httpContext.GetUserId();
        var command = new AddChatMemberCommand(id, requesterId, request.UserId);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.NoContent()
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> UpdateChat(
        Guid              id,
        UpdateChatRequest request,
        HttpContext        httpContext,
        ISender           sender,
        CancellationToken ct)
    {
        var requesterId = httpContext.GetUserId();
        var command = new UpdateChatCommand(id, requesterId, request.Name, request.AvatarUrl);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.NoContent()
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> RemoveChatMember(
        Guid              id,
        Guid              userId,
        HttpContext        httpContext,
        ISender           sender,
        CancellationToken ct)
    {
        var requesterId = httpContext.GetUserId();
        var command = new RemoveChatMemberCommand(id, requesterId, userId);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.NoContent()
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> DeleteChat(
        Guid              id,
        HttpContext        httpContext,
        ISender            sender,
        CancellationToken  ct)
    {
        var requesterId = httpContext.GetUserId();
        var command = new DeleteChatCommand(id, requesterId);
        var result = await sender.Send(command, ct);

        return result.IsSuccess
            ? Results.NoContent()
            : result.Error.ToHttpResult();
    }

    private static async Task<IResult> MarkChatRead(
        Guid              id,
        HttpContext        httpContext,
        ISender            sender,
        CancellationToken  ct)
    {
        var requesterId = httpContext.GetUserId();
        var result = await sender.Send(new MarkChatReadCommand(id, requesterId), ct);
        return result.IsSuccess ? Results.NoContent() : result.Error.ToHttpResult();
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

public sealed record UpdateChatRequest(string? Name, string? AvatarUrl);
public sealed record AddChatMemberRequest(Guid UserId);
public sealed record CreateDirectChatRequest(Guid OtherUserId);
public sealed record CreateGroupChatRequest(string Name, List<Guid>? MemberIds);
namespace Messenger.Modules.Notifications.Presentation;

using Messenger.Modules.Notifications.Application;
using Messenger.Modules.Notifications.Infrastructure;
using Messenger.Shared.Kernel.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;

public static class NotificationsEndpoints
{
    public static IEndpointRouteBuilder MapNotificationsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/notifications")
            .WithTags("Notifications")
            .RequireAuthorization();

        group.MapGet("/vapid-public-key", GetVapidPublicKey)
            .WithName("GetVapidPublicKey")
            .Produces<VapidPublicKeyResponse>();

        group.MapPost("/subscriptions", SaveSubscription)
            .WithName("SavePushSubscription")
            .Produces(StatusCodes.Status204NoContent);

        group.MapDelete("/subscriptions", DeleteSubscription)
            .WithName("DeletePushSubscription")
            .Produces(StatusCodes.Status204NoContent);

        return app;
    }

    private static IResult GetVapidPublicKey(IOptions<WebPushOptions> options) =>
        Results.Ok(new VapidPublicKeyResponse(options.Value.PublicKey));

    private static async Task<IResult> SaveSubscription(
        [FromBody] SavePushSubscriptionRequest request,
        [FromServices] IPushSubscriptionRepository repository,
        HttpContext ctx,
        CancellationToken ct)
    {
        await repository.UpsertAsync(
            ctx.GetUserId(),
            request.Endpoint,
            request.Keys.P256dh,
            request.Keys.Auth,
            ctx.Request.Headers.UserAgent.ToString(),
            ct);

        return Results.NoContent();
    }

    private static async Task<IResult> DeleteSubscription(
        [FromBody] DeletePushSubscriptionRequest request,
        [FromServices] IPushSubscriptionRepository repository,
        HttpContext ctx,
        CancellationToken ct)
    {
        await repository.DeleteAsync(ctx.GetUserId(), request.Endpoint, ct);
        return Results.NoContent();
    }
}

public sealed record VapidPublicKeyResponse(string PublicKey);
public sealed record PushSubscriptionKeys(string P256dh, string Auth);
public sealed record SavePushSubscriptionRequest(string Endpoint, PushSubscriptionKeys Keys);
public sealed record DeletePushSubscriptionRequest(string Endpoint);

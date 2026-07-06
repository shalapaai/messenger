namespace Messenger.Modules.Notifications.Application;

using System.Net;
using System.Text.Json;
using Messenger.Modules.Notifications.Domain;
using Messenger.Modules.Notifications.Infrastructure;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using WebPush;
using StoredPushSubscription = Messenger.Modules.Notifications.Domain.PushSubscription;

public sealed record PushNotificationPayload(
    string Title,
    string Body,
    string Url,
    string? ChatId = null,
    string? SenderId = null,
    string? Icon = null,
    string? Tag = null);

public interface IWebPushNotificationSender
{
    Task SendAsync(IReadOnlyList<StoredPushSubscription> subscriptions, PushNotificationPayload payload, CancellationToken ct = default);
}

internal sealed class WebPushNotificationSender(
    IOptions<WebPushOptions> options,
    IPushSubscriptionRepository repository,
    ILogger<WebPushNotificationSender> logger) : IWebPushNotificationSender
{
    private readonly WebPushOptions _options = options.Value;

    public async Task SendAsync(IReadOnlyList<StoredPushSubscription> subscriptions, PushNotificationPayload payload, CancellationToken ct = default)
    {
        if (!_options.IsConfigured || subscriptions.Count == 0) return;

        var vapidDetails = new VapidDetails(_options.Subject, _options.PublicKey, _options.PrivateKey);
        using var client = new WebPushClient();
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        foreach (var subscription in subscriptions)
        {
            var webPushSubscription = new WebPush.PushSubscription(
                subscription.Endpoint,
                subscription.P256dh,
                subscription.Auth);

            try
            {
                await client.SendNotificationAsync(webPushSubscription, json, vapidDetails, ct);
            }
            catch (WebPushException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
            {
                await repository.DeleteByEndpointAsync(subscription.Endpoint, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to send web push notification to endpoint {Endpoint}", subscription.Endpoint);
            }
        }
    }
}

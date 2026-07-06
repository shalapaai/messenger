namespace Messenger.Modules.Notifications.Application;

public sealed class WebPushOptions
{
    public string Subject { get; init; } = "mailto:dev@example.com";
    public string PublicKey { get; init; } = string.Empty;
    public string PrivateKey { get; init; } = string.Empty;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(PublicKey) &&
        !string.IsNullOrWhiteSpace(PrivateKey);
}

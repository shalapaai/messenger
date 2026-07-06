namespace Messenger.Modules.Notifications;

using Messenger.Modules.Notifications.Application;
using Messenger.Modules.Notifications.Infrastructure;
using Messenger.Modules.Notifications.Presentation;
using Messenger.Shared.Kernel.Abstractions;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public sealed class NotificationsModule : IModuleInstaller
{
    public void Install(IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("MessengerDb")!;

        services.AddDbContext<NotificationsDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "notifications")));

        services.Configure<WebPushOptions>(configuration.GetSection("WebPush"));
        services.AddScoped<IPushSubscriptionRepository, PushSubscriptionRepository>();
        services.AddScoped<IWebPushNotificationSender, WebPushNotificationSender>();
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(NotificationsModule).Assembly));
    }

    public async Task MigrateAsync(IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<NotificationsDbContext>();

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE SCHEMA IF NOT EXISTS notifications;

            CREATE TABLE IF NOT EXISTS notifications.push_subscriptions (
                id uuid PRIMARY KEY,
                user_id uuid NOT NULL,
                endpoint text NOT NULL,
                p256dh text NOT NULL,
                auth text NOT NULL,
                user_agent text NULL,
                created_at timestamp with time zone NOT NULL,
                updated_at timestamp with time zone NOT NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_push_subscriptions_endpoint
                ON notifications.push_subscriptions (endpoint);

            CREATE INDEX IF NOT EXISTS idx_notifications_push_subscriptions_user_id
                ON notifications.push_subscriptions (user_id);
            """,
            ct);
    }
}

public static class NotificationsModuleExtensions
{
    public static IEndpointRouteBuilder MapNotificationsModule(this IEndpointRouteBuilder app) =>
        app.MapNotificationsEndpoints();
}

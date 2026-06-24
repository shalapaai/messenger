namespace Messenger.Modules.Notifications;

using Messenger.Shared.Kernel.Abstractions;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public sealed class NotificationsModule : IModuleInstaller
{
    public void Install(IServiceCollection services, IConfiguration configuration)
    {
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(NotificationsModule).Assembly));
    }
}

public static class NotificationsModuleExtensions
{
    public static IEndpointRouteBuilder MapNotificationsModule(this IEndpointRouteBuilder app) => app;
}

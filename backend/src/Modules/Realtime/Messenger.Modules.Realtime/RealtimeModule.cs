namespace Messenger.Modules.Realtime;

using Messenger.Modules.Realtime.Hubs;
using Messenger.Shared.Kernel.Abstractions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public sealed class RealtimeModule : IModuleInstaller
{
    public void Install(IServiceCollection services, IConfiguration configuration)
    {
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(RealtimeModule).Assembly));
    }
}

public static class RealtimeModuleExtensions
{
    public static IEndpointRouteBuilder MapRealtimeModule(this IEndpointRouteBuilder app)
    {
        app.MapHub<MessengerHub>("/hubs/messenger");
        return app;
    }
}

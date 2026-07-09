namespace Messenger.Modules.Localization;

using Messenger.Modules.Localization.Middleware;
using Messenger.Shared.Kernel.Abstractions;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public sealed class LocalizationModule : IModuleInstaller
{
    public void Install(IServiceCollection services, IConfiguration configuration)
    {
        services.AddLocalization(options =>
            options.ResourcesPath = "Resources");
    }
}

public static class LocalizationModuleExtensions
{
    public static IApplicationBuilder UseLocalizationModule(this IApplicationBuilder app)
    {
        app.UseRequestLocalization(options =>
        {
            string[] supportedCultures = ["en", "ru"];
            options.SetDefaultCulture("en")
                   .AddSupportedCultures(supportedCultures)
                   .AddSupportedUICultures(supportedCultures);
        });

        app.UseMiddleware<RequestCultureMiddleware>();

        return app;
    }
}

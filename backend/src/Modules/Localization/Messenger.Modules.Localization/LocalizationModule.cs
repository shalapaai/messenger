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
        // Встроенная локализация .NET через .resx файлы
        services.AddLocalization(options =>
            options.ResourcesPath = "Resources");
    }
}

public static class LocalizationModuleExtensions
{
    public static IApplicationBuilder UseLocalizationModule(this IApplicationBuilder app)
    {
        // Встроенный ASP.NET Core middleware для культуры (из RequestLocalizationOptions)
        app.UseRequestLocalization(options =>
        {
            string[] supportedCultures = ["en", "ru"];
            options.SetDefaultCulture("en")
                   .AddSupportedCultures(supportedCultures)
                   .AddSupportedUICultures(supportedCultures);
            // Провайдеры культуры: QueryString, Cookie, AcceptLanguage (в порядке приоритета)
        });

        // Наш кастомный middleware поверх (упрощённый query-string + header detector)
        app.UseMiddleware<RequestCultureMiddleware>();

        return app;
    }
}

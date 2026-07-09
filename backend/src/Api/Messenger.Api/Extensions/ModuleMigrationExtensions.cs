namespace Messenger.Api.Extensions;

using Messenger.Shared.Kernel.Abstractions;
using Serilog;

public static class ModuleMigrationExtensions
{
    public static async Task MigrateModulesWithRetryAsync(this WebApplication app, IModuleInstaller[] modules)
    {
        if (app.Environment.IsEnvironment("Testing"))
            return;

        const int maxAttempts = 10;
        var delay = TimeSpan.FromSeconds(3);
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                foreach (var module in modules)
                    await module.MigrateAsync(app.Services);
                break;
            }
            catch (Exception ex) when (attempt < maxAttempts)
            {
                Log.Warning(ex, "Migration attempt {Attempt}/{Max} failed, retrying in {Delay}s…",
                    attempt, maxAttempts, delay.TotalSeconds);
                await Task.Delay(delay);
                delay = TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 2, 30));
            }
        }
    }
}

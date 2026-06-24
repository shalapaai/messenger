namespace Messenger.Modules.Chats;

using FluentValidation;
using Messenger.Shared.Kernel.Abstractions;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public sealed class ChatsModule : IModuleInstaller
{
    public void Install(IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("MessengerDb")!;

        services.AddDbContext<Infrastructure.ChatsDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "chats")));

        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(ChatsModule).Assembly));
        services.AddValidatorsFromAssembly(typeof(ChatsModule).Assembly);
    }
}

public static class ChatsModuleExtensions
{
    public static IEndpointRouteBuilder MapChatsModule(this IEndpointRouteBuilder app) => app;
}

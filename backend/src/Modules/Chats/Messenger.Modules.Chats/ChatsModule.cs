namespace Messenger.Modules.Chats;

using FluentValidation;
using MediatR;
using Messenger.Modules.Chats.Application;
using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Chats.Infrastructure;
using Messenger.Modules.Chats.Infrastructure.Repositories;
using Messenger.Modules.Chats.Presentation;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Behaviors;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public sealed class ChatsModule : IModuleInstaller
{
    public void Install(IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("MessengerDb")!;

        services.AddDbContext<ChatsDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "chats")));

        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<ChatsDbContext>());
        services.AddScoped<IChatRepository, ChatRepository>();

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(typeof(ChatsModule).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationPipelineBehavior<,>));
        });
        services.AddValidatorsFromAssembly(typeof(ChatsModule).Assembly);
    }

    public async Task MigrateAsync(IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ChatsDbContext>();
        await db.Database.EnsureCreatedAsync(ct);
    }
}

public static class ChatsModuleExtensions
{
    public static IEndpointRouteBuilder MapChatsModule(this IEndpointRouteBuilder app) =>
        app.MapChatsEndpoints();
}

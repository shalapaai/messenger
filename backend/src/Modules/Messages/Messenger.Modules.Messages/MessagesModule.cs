namespace Messenger.Modules.Messages;

using FluentValidation;
using Messenger.Modules.Messages.Application;
using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Modules.Messages.Domain;
using Messenger.Modules.Messages.Infrastructure;
using Messenger.Modules.Messages.Infrastructure.Repositories;
using Messenger.Modules.Messages.Presentation;
using Messenger.Shared.Kernel.Abstractions;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public sealed class MessagesModule : IModuleInstaller
{
    public void Install(IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("MessengerDb")!;

        services.AddDbContext<MessagesDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "messages")));

        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<MessagesDbContext>());
        services.AddScoped<IMessageRepository, MessageRepository>();
        services.AddScoped<IMessagesModule, MessagesModuleApi>();

        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(MessagesModule).Assembly));
        services.AddValidatorsFromAssembly(typeof(MessagesModule).Assembly);
    }
}

public static class MessagesModuleExtensions
{
    public static IEndpointRouteBuilder MapMessagesModule(this IEndpointRouteBuilder app) =>
        app.MapMessagesEndpoints();
}

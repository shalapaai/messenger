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

    public async Task MigrateAsync(IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<MessagesDbContext>();
        await db.Database.EnsureCreatedAsync(ct);
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS messages.message_reaction (
                id uuid PRIMARY KEY,
                message_id uuid NOT NULL,
                user_id uuid NOT NULL,
                emoji character varying(16) NOT NULL,
                created_at timestamp with time zone NOT NULL,
                updated_at timestamp with time zone NOT NULL,
                CONSTRAINT fk_message_reaction_message_message_id
                    FOREIGN KEY (message_id)
                    REFERENCES messages.message (id)
                    ON DELETE CASCADE
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ux_message_reaction_message_id_user_id
                ON messages.message_reaction (message_id, user_id);

            CREATE INDEX IF NOT EXISTS ix_message_reaction_message_id
                ON messages.message_reaction (message_id);

            CREATE INDEX IF NOT EXISTS ix_message_reaction_user_id
                ON messages.message_reaction (user_id);
            """,
            ct);
    }
}

public static class MessagesModuleExtensions
{
    public static IEndpointRouteBuilder MapMessagesModule(this IEndpointRouteBuilder app) =>
        app.MapMessagesEndpoints();
}

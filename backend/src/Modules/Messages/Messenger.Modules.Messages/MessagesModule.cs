namespace Messenger.Modules.Messages;

using FluentValidation;
using MediatR;
using Messenger.Modules.Messages.Application;
using Messenger.Modules.Messages.Application.Contracts;
using Messenger.Modules.Messages.Domain;
using Messenger.Modules.Messages.Infrastructure;
using Messenger.Modules.Messages.Infrastructure.Repositories;
using Messenger.Modules.Messages.Presentation;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Behaviors;
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

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(typeof(MessagesModule).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationPipelineBehavior<,>));
        });
        services.AddValidatorsFromAssembly(typeof(MessagesModule).Assembly);
    }

    public async Task MigrateAsync(IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<MessagesDbContext>();
        await db.Database.EnsureCreatedAsync(ct);

        // EnsureCreatedAsync — no-op на уже существующей базе, поэтому таблицы для опросов
        // (добавлены позже message/message_reaction) досоздаются тут же, как и message_reaction
        // раньше — см. init.sql, тот же DDL для свежих баз.
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS messages.poll_option (
                id         uuid PRIMARY KEY,
                message_id uuid NOT NULL,
                text       character varying(100) NOT NULL,
                sort_order integer NOT NULL DEFAULT 0,
                CONSTRAINT fk_poll_option_message_id
                    FOREIGN KEY (message_id)
                    REFERENCES messages.message (id)
                    ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS ix_poll_option_message_id
                ON messages.poll_option (message_id);

            CREATE TABLE IF NOT EXISTS messages.poll_vote (
                id         uuid PRIMARY KEY,
                message_id uuid NOT NULL,
                option_id  uuid NOT NULL,
                user_id    uuid NOT NULL,
                voted_at   timestamp with time zone NOT NULL,
                CONSTRAINT fk_poll_vote_message_id
                    FOREIGN KEY (message_id)
                    REFERENCES messages.message (id)
                    ON DELETE CASCADE
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ux_poll_vote_message_id_user_id
                ON messages.poll_vote (message_id, user_id);

            CREATE INDEX IF NOT EXISTS ix_poll_vote_message_id
                ON messages.poll_vote (message_id);
            """,
            ct);
    }
}

public static class MessagesModuleExtensions
{
    public static IEndpointRouteBuilder MapMessagesModule(this IEndpointRouteBuilder app) =>
        app.MapMessagesEndpoints().MapPollsEndpoints();
}

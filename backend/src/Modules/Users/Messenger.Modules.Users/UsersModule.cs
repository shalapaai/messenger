namespace Messenger.Modules.Users;

using FluentValidation;
using Messenger.Modules.Users.Application.Abstractions;
using Messenger.Modules.Users.Application.Contracts;
using Messenger.Modules.Users.Infrastructure;
using Messenger.Modules.Users.Infrastructure.Repositories;
using Messenger.Modules.Users.Presentation;
using Messenger.Shared.Kernel.Abstractions;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public sealed class UsersModule : IModuleInstaller
{
    public void Install(IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("MessengerDb")!;

        services.AddDbContext<UsersDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "users")));

        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<UsersDbContext>());
        services.AddScoped<IUserProfileRepository, UserProfileRepository>();
        services.AddScoped<IUsersModule, UsersModuleApi>();

        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(UsersModule).Assembly));
        services.AddValidatorsFromAssembly(typeof(UsersModule).Assembly);
    }

    public async Task MigrateAsync(IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<UsersDbContext>();
        await db.Database.MigrateAsync(ct);
    }
}

public static class UsersModuleExtensions
{
    public static IEndpointRouteBuilder MapUsersModule(this IEndpointRouteBuilder app) =>
        app.MapUsersEndpoints();
}

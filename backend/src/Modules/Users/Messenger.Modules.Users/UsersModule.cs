namespace Messenger.Modules.Users;

using FluentValidation;
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

        services.AddDbContext<Infrastructure.UsersDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "users")));

        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(UsersModule).Assembly));
        services.AddValidatorsFromAssembly(typeof(UsersModule).Assembly);
    }
}

public static class UsersModuleExtensions
{
    public static IEndpointRouteBuilder MapUsersModule(this IEndpointRouteBuilder app) => app;
}

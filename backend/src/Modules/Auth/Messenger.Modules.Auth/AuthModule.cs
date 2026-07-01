namespace Messenger.Modules.Auth;

using FluentValidation;
using MediatR;
using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Infrastructure;
using Messenger.Modules.Auth.Infrastructure.Repositories;
using Messenger.Modules.Auth.Presentation;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Behaviors;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Resend;

public sealed class AuthModule : IModuleInstaller
{
    public void Install(IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("MessengerDb")!;
        services.AddDbContext<AuthDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "auth")));

        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<AuthDbContext>());
        services.AddScoped<IUserAuthRepository, UserAuthRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();

        // Email / 2FA
        services.AddMemoryCache();
        var twoFactorEnabled = configuration.GetValue<bool>("TwoFactor:Enabled");
        if (twoFactorEnabled)
        {
            services.AddOptions<ResendClientOptions>()
                .Configure(o => o.ApiToken = configuration["Resend:ApiKey"]!);
            services.AddTransient<IResend, ResendClient>();
            services.AddScoped<IEmailService, ResendEmailService>();
        }
        else
        {
            services.AddSingleton<IEmailService, NullEmailService>();
        }

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(typeof(AuthModule).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationPipelineBehavior<,>));
        });
        services.AddValidatorsFromAssembly(typeof(AuthModule).Assembly);
    }

    public async Task MigrateAsync(IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
        await db.Database.EnsureCreatedAsync(ct);
    }
}

public static class AuthModuleExtensions
{
    public static IEndpointRouteBuilder MapAuthModule(this IEndpointRouteBuilder app) =>
        app.MapAuthEndpoints();
}

namespace Messenger.Modules.Files;

using FluentValidation;
using Messenger.Modules.Files.Application;
using Messenger.Modules.Files.Application.Contracts;
using Messenger.Modules.Files.Application.Abstractions;
using Messenger.Modules.Files.Domain;
using Messenger.Modules.Files.Infrastructure;
using Messenger.Modules.Files.Infrastructure.Repositories;
using Messenger.Modules.Files.Infrastructure.Storage;
using Messenger.Modules.Files.Presentation;
using Messenger.Shared.Kernel.Abstractions;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public sealed class FilesModule : IModuleInstaller
{
    public void Install(IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("MessengerDb")!;

        services.AddDbContext<FilesDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "files")));

        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<FilesDbContext>());
        services.AddScoped<IFileRepository, FileRepository>();

        var storageType = configuration["FileStorage:Type"] ?? "Local";

        if (storageType.Equals("S3", StringComparison.OrdinalIgnoreCase))
        {
            services.Configure<S3StorageOptions>(
                configuration.GetSection(S3StorageOptions.SectionName));
            services.AddScoped<IFileStorage, S3FileStorage>();
        }
        else
        {
            services.Configure<LocalStorageOptions>(
                configuration.GetSection(LocalStorageOptions.SectionName));
            services.AddScoped<IFileStorage, LocalFileStorage>();
        }

        services.AddScoped<IFilesModule, FilesModuleApi>();

        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(FilesModule).Assembly));
        services.AddValidatorsFromAssembly(typeof(FilesModule).Assembly);
    }

    public async Task MigrateAsync(IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<FilesDbContext>();
        await db.Database.EnsureCreatedAsync(ct);
    }
}

public static class FilesModuleExtensions
{
    public static IEndpointRouteBuilder MapFilesModule(this IEndpointRouteBuilder app) =>
        app.MapFilesEndpoints();
}

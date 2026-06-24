namespace Messenger.Modules.Files;

using FluentValidation;
using Messenger.Modules.Files.Application;
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

        // Выбор реализации хранилища по конфигурации
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

        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(FilesModule).Assembly));
        services.AddValidatorsFromAssembly(typeof(FilesModule).Assembly);
    }
}

public static class FilesModuleExtensions
{
    public static IEndpointRouteBuilder MapFilesModule(this IEndpointRouteBuilder app) =>
        app.MapFilesEndpoints();
}

namespace Messenger.Modules.Files;

using FluentValidation;
using Messenger.Shared.Kernel.Abstractions;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public sealed class FilesModule : IModuleInstaller
{
    public void Install(IServiceCollection services, IConfiguration configuration)
    {
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(FilesModule).Assembly));
        services.AddValidatorsFromAssembly(typeof(FilesModule).Assembly);
    }
}

public static class FilesModuleExtensions
{
    public static IEndpointRouteBuilder MapFilesModule(this IEndpointRouteBuilder app) => app;
}

namespace Messenger.Shared.Kernel.Abstractions;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public interface IModuleInstaller
{
    void Install(IServiceCollection services, IConfiguration configuration);
}

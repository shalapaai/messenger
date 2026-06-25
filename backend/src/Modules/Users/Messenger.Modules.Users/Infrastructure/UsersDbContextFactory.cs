namespace Messenger.Modules.Users.Infrastructure;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

public sealed class UsersDbContextFactory : IDesignTimeDbContextFactory<UsersDbContext>
{
    public UsersDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(FindApiProjectRoot())
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("MessengerDb")
            ?? "Host=localhost;Port=5432;Database=messenger;Username=messenger;Password=messenger_dev";

        var options = new DbContextOptionsBuilder<UsersDbContext>()
            .UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "users"))
            .Options;

        return new UsersDbContext(options);
    }

    private static string FindApiProjectRoot()
    {
        var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (dir is not null)
        {
            var apiPath = Path.Combine(dir.FullName, "src", "Api", "Messenger.Api");
            if (Directory.Exists(apiPath))
                return apiPath;
            dir = dir.Parent;
        }
        return Directory.GetCurrentDirectory();
    }
}

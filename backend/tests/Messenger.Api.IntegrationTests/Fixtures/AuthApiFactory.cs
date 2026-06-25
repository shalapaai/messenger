namespace Messenger.Api.IntegrationTests.Fixtures;

using Messenger.Modules.Auth.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Testcontainers.Redis;

public sealed class AuthApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithDatabase("messenger_test")
        .WithUsername("test_user")
        .WithPassword("test_pass")
        .Build();

    private readonly RedisContainer _redis = new RedisBuilder().Build();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        await _redis.StartAsync();

        // Override connection strings before Program.cs runs so AuthModule.Install()
        // captures the Testcontainers values from configuration.
        Environment.SetEnvironmentVariable("ConnectionStrings__MessengerDb", _postgres.GetConnectionString());
        Environment.SetEnvironmentVariable("Redis__ConnectionString",
            _redis.GetConnectionString() + ",abortConnect=false");

        _ = CreateClient();

        // Create schema directly — bypasses EF Core migration history to guarantee
        // tables exist in the Testcontainers database before tests run.
        var options = new DbContextOptionsBuilder<AuthDbContext>()
            .UseNpgsql(_postgres.GetConnectionString(), npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "auth"))
            .Options;
        await using var db = new AuthDbContext(options);
        await db.Database.EnsureCreatedAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // "Testing" causes Program.cs to skip MigrateAsync so it doesn't try to
        // connect to the production DB before the Testcontainers strings are active.
        builder.UseEnvironment("Testing");
    }

    public new async Task DisposeAsync()
    {
        Environment.SetEnvironmentVariable("ConnectionStrings__MessengerDb", null);
        Environment.SetEnvironmentVariable("Redis__ConnectionString", null);
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
        await _redis.DisposeAsync();
    }
}

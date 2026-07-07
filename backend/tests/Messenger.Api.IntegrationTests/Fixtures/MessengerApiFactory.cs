namespace Messenger.Api.IntegrationTests.Fixtures;

using Messenger.Modules.Auth.Infrastructure;
using Messenger.Modules.Chats.Infrastructure;
using Messenger.Modules.Files.Infrastructure;
using Messenger.Modules.Messages.Infrastructure;
using Messenger.Modules.Users.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;
using Testcontainers.Redis;

// Как AuthApiFactory, но поднимает схемы всех модулей — нужен для сквозных сценариев
// (чат → сообщение → файл), которым одной auth.* схемы недостаточно.
public sealed class MessengerApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
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

        Environment.SetEnvironmentVariable("ConnectionStrings__MessengerDb", _postgres.GetConnectionString());
        Environment.SetEnvironmentVariable("Redis__ConnectionString",
            _redis.GetConnectionString() + ",abortConnect=false");

        _ = CreateClient();

        var connectionString = _postgres.GetConnectionString();

        // Not EnsureCreatedAsync: once the FIRST DbContext creates any tables in this fresh
        // Testcontainers database, EF considers the whole database "already set up" and every
        // later EnsureCreatedAsync call silently no-ops — only the first schema would ever be
        // created. CreateTablesAsync bypasses that "does the database already exist" check and
        // creates each context's own tables unconditionally.
        await CreateTablesAsync(new DbContextOptionsBuilder<AuthDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "auth"))
            .Options, o => new AuthDbContext(o));

        // The mediator dependency is only used from SaveChangesAsync (to publish domain events),
        // which CreateTablesAsync never touches — so it's never dereferenced here; null is safe.
        await CreateTablesAsync(new DbContextOptionsBuilder<UsersDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "users"))
            .Options, o => new UsersDbContext(o, null!));

        await CreateTablesAsync(new DbContextOptionsBuilder<ChatsDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "chats"))
            .Options, o => new ChatsDbContext(o, null!));

        await CreateTablesAsync(new DbContextOptionsBuilder<MessagesDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "messages"))
            .Options, o => new MessagesDbContext(o, null!));

        await CreateTablesAsync(new DbContextOptionsBuilder<FilesDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "files"))
            .Options, o => new FilesDbContext(o));
    }

    private static async Task CreateTablesAsync<TOptions, TContext>(TOptions options, Func<TOptions, TContext> factory)
        where TContext : DbContext
    {
        await using var db = factory(options);
        var creator = ((IInfrastructure<IServiceProvider>)db).Instance
            .GetRequiredService<IRelationalDatabaseCreator>();
        await creator.CreateTablesAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.UseEnvironment("Testing");

    public new async Task DisposeAsync()
    {
        Environment.SetEnvironmentVariable("ConnectionStrings__MessengerDb", null);
        Environment.SetEnvironmentVariable("Redis__ConnectionString", null);
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
        await _redis.DisposeAsync();
    }
}

using Messenger.Api.Extensions;
using Messenger.Api.Middleware;
using Messenger.Modules.Auth;
using Messenger.Modules.Chats;
using Messenger.Modules.Files;
using Messenger.Modules.Localization;
using Messenger.Modules.Messages;
using Messenger.Modules.Notifications;
using Messenger.Modules.Realtime;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Modules.Users;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Presence;
using Microsoft.AspNetCore.SignalR;
using Serilog;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// ── Logging ───────────────────────────────────────────────────────────────────
builder.Host.UseSerilog((ctx, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration));

// ── Redis ─────────────────────────────────────────────────────────────────────
var redisConnectionString = builder.Configuration["Redis:ConnectionString"]!;
builder.Services.AddSingleton<IConnectionMultiplexer>(
    ConnectionMultiplexer.Connect(redisConnectionString));
builder.Services.AddSingleton<IPresenceTracker, RedisPresenceTracker>();

// ── Modules ───────────────────────────────────────────────────────────────────
IModuleInstaller[] modules =
[
    new LocalizationModule(),
    new AuthModule(),
    new UsersModule(),
    new ChatsModule(),
    new MessagesModule(),
    new FilesModule(),
    new NotificationsModule(),
    new RealtimeModule()
];

foreach (var module in modules)
    module.Install(builder.Services, builder.Configuration);

// Троттлинг на "дорогие"/потенциально спамные хаб-методы (SendMessage/StartTyping/StopTyping) —
// см. HubRateLimitFilter, регистрируется как фильтр хаба через opts.AddFilter ниже.
builder.Services.AddSingleton<HubRateLimitFilter>();

// SignalR backplane → Redis (горизонтальное масштабирование)
builder.Services.AddSignalR(opts =>
{
    opts.EnableDetailedErrors         = builder.Environment.IsDevelopment();
    opts.MaximumReceiveMessageSize    = 32 * 1024;
    opts.ClientTimeoutInterval        = TimeSpan.FromSeconds(60);
    opts.KeepAliveInterval            = TimeSpan.FromSeconds(15);
    opts.AddFilter<HubRateLimitFilter>();
}).AddStackExchangeRedis(redisConnectionString, opts =>
{
    opts.Configuration.ChannelPrefix = RedisChannel.Literal("messenger");
});

// ── Authentication ────────────────────────────────────────────────────────────
builder.Services.AddMessengerJwtAuthentication(builder.Configuration);

// ── API ───────────────────────────────────────────────────────────────────────
builder.Services.AddMessengerSwagger();

builder.Services.AddCors(opts =>
    opts.AddDefaultPolicy(policy =>
        policy
            .WithOrigins(builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? ["*"])
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials())); // Обязательно для SignalR + авторизованные запросы

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

builder.Services.AddMessengerRateLimiting();

// Health checks для Docker HEALTHCHECK и load balancer
builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("MessengerDb")!, "SELECT 1;", name: "postgres")
    .AddRedis(redisConnectionString, "redis");

var app = builder.Build();

// ── Migrations ────────────────────────────────────────────────────────────────
await app.MigrateModulesWithRetryAsync(modules);

// ── Middleware Pipeline ───────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(opts =>
    {
        opts.SwaggerEndpoint("/swagger/v1/swagger.json", "Messenger API v1");
        opts.DisplayRequestDuration();
    });
}

if (!app.Environment.IsDevelopment())
    app.UseHsts();

app.UseHttpsRedirection();
app.UseCors();
app.UseSerilogRequestLogging(opts =>
{
    opts.EnrichDiagnosticContext = (diag, ctx) =>
    {
        diag.Set("RequestHost", ctx.Request.Host.Value ?? string.Empty);
        diag.Set("UserAgent", ctx.Request.Headers.UserAgent.ToString());
    };
});
app.UseLocalizationModule();     // культура из Accept-Language / ?lang=
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseExceptionHandler();

// ── Endpoints ─────────────────────────────────────────────────────────────────
app.MapHealthChecks("/health");

app.MapAuthModule();
app.MapUsersModule();
app.MapChatsModule();
app.MapMessagesModule();
app.MapFilesModule();
app.MapNotificationsModule();
app.MapRealtimeModule();         // /hubs/messenger

app.Run();

// Экспортируем для интеграционных тестов
public partial class Program;

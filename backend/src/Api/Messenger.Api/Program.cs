using System.Text;
using Messenger.Api.Middleware;
using Messenger.Modules.Auth;
using Messenger.Modules.Chats;
using Messenger.Modules.Files;
using Messenger.Modules.Localization;
using Messenger.Modules.Messages;
using Messenger.Modules.Notifications;
using Messenger.Modules.Realtime;
using Messenger.Modules.Users;
using Messenger.Shared.Kernel.Abstractions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// ── Logging ───────────────────────────────────────────────────────────────────
builder.Host.UseSerilog((ctx, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration));

// ── Redis ─────────────────────────────────────────────────────────────────────
var redisConnectionString = builder.Configuration["Redis:ConnectionString"]!;
builder.Services.AddSingleton<IConnectionMultiplexer>(
    ConnectionMultiplexer.Connect(redisConnectionString));

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

// SignalR backplane → Redis (горизонтальное масштабирование)
builder.Services.AddSignalR(opts =>
{
    opts.EnableDetailedErrors         = builder.Environment.IsDevelopment();
    opts.MaximumReceiveMessageSize    = 32 * 1024;
    opts.ClientTimeoutInterval        = TimeSpan.FromSeconds(60);
    opts.KeepAliveInterval            = TimeSpan.FromSeconds(15);
}).AddStackExchangeRedis(redisConnectionString, opts =>
{
    opts.Configuration.ChannelPrefix = RedisChannel.Literal("messenger");
});

// ── Authentication ────────────────────────────────────────────────────────────
var jwtSection = builder.Configuration.GetSection("Jwt");
var secretKey  = Encoding.UTF8.GetBytes(jwtSection["SecretKey"]!);

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey         = new SymmetricSecurityKey(secretKey),
            ValidateIssuer           = true,
            ValidIssuer              = jwtSection["Issuer"],
            ValidateAudience         = true,
            ValidAudience            = jwtSection["Audience"],
            ValidateLifetime         = true,
            ClockSkew                = TimeSpan.Zero
        };
        // SignalR передаёт токен через query string для WebSocket upgrade
        opts.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && ctx.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ── API ───────────────────────────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(opts =>
{
    opts.SwaggerDoc("v1", new OpenApiInfo
    {
        Title       = "Messenger API",
        Version     = "v1",
        Description = "Real-time messenger backend"
    });
    opts.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header,
        Description  = "Вставьте access token (без префикса Bearer)"
    });
    // Замок добавляется только на защищённые эндпойнты; анонимные (login/register/...) открыты
    opts.OperationFilter<Messenger.Api.Middleware.SecurityOperationFilter>();
});

builder.Services.AddCors(opts =>
    opts.AddDefaultPolicy(policy =>
        policy
            .WithOrigins(builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? ["*"])
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials())); // Обязательно для SignalR + авторизованные запросы

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// Health checks для Docker HEALTHCHECK и load balancer
builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("MessengerDb")!, "SELECT 1;", name: "postgres")
    .AddRedis(redisConnectionString, "redis");

var app = builder.Build();

// ── Migrations ────────────────────────────────────────────────────────────────
// Skipped in the "Testing" environment — AuthApiFactory runs them explicitly
// after the test server starts, so the test DB connection string is in effect.
if (!app.Environment.IsEnvironment("Testing"))
{
    const int maxAttempts = 10;
    var delay = TimeSpan.FromSeconds(3);
    for (var attempt = 1; attempt <= maxAttempts; attempt++)
    {
        try
        {
            foreach (var module in modules)
                await module.MigrateAsync(app.Services);
            break;
        }
        catch (Exception ex) when (attempt < maxAttempts)
        {
            Log.Warning(ex, "Migration attempt {Attempt}/{Max} failed, retrying in {Delay}s…",
                attempt, maxAttempts, delay.TotalSeconds);
            await Task.Delay(delay);
            delay = TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 2, 30));
        }
    }
}

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

using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Messenger.Api.Middleware;
using Messenger.Modules.Auth;
using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Chats;
using Messenger.Modules.Files;
using Messenger.Modules.Localization;
using Messenger.Modules.Messages;
using Messenger.Modules.Notifications;
using Messenger.Modules.Realtime;
using Messenger.Modules.Realtime.Hubs;
using Messenger.Modules.Users;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Extensions;
using Messenger.Shared.Kernel.Presence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.SignalR;
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
        opts.Events = new JwtBearerEvents
        {
            // SignalR передаёт токен через query string для WebSocket upgrade
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && ctx.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            },
            // Подпись/срок годности токена — не единственное, что должно быть валидно: если
            // пользователя, на которого он выписан, больше нет (типичный dev-кейс — пересоздали
            // БД, а в браузере остался старый access token), токен формально проходит проверку
            // подписи, но дальше всё равно упрётся в 404 на каждом запросе, а не в явный 401,
            // из-за чего клиент никогда не попытается его обновить/сбросить сам. Роняем такой
            // токен явно на уровне аутентификации — тогда клиент получает обычный 401, пробует
            // refresh, тот тоже не находит пользователя и стирает и access, и refresh-cookie.
            OnTokenValidated = async ctx =>
            {
                var idClaim = ctx.Principal?.FindFirst(ClaimTypes.NameIdentifier)
                    ?? ctx.Principal?.FindFirst("nameid")
                    ?? ctx.Principal?.FindFirst("sub");

                if (idClaim is null || !Guid.TryParse(idClaim.Value, out var userId))
                {
                    ctx.Fail("Token is missing a valid user id claim");
                    return;
                }

                var userRepository = ctx.HttpContext.RequestServices.GetRequiredService<IUserAuthRepository>();
                var user = await userRepository.GetByIdAsync(userId, ctx.HttpContext.RequestAborted);
                if (user is null)
                    ctx.Fail("User no longer exists");
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

// Троттлинг по IP на чувствительных auth-эндпойнтах — без этого login/verify-otp/reset-password
// можно долбить перебором без каких-либо ограничений (пароль, 6-значный OTP-код, код сброса).
// "auth" — обычные попытки входа/регистрации, "auth-strict" — узкие окна с секретом, который
// подбирается перебором (OTP, код сброса пароля).
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = 10,
                QueueLimit = 0,
            }));

    options.AddPolicy("auth-strict", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(5),
                PermitLimit = 5,
                QueueLimit = 0,
            }));

    // Эти два — на уже аутентифицированных эндпойнтах, поэтому партиционируем по userId
    // (не по IP): один аккаунт не может обойти лимит сменой IP, а несколько пользователей
    // за одним NAT/офисным IP не делят один и тот же лимит.
    options.AddPolicy("messaging", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: UserIdOrIp(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromSeconds(10),
                PermitLimit = 20,
                QueueLimit = 0,
            }));

    options.AddPolicy("uploads", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: UserIdOrIp(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = 10,
                QueueLimit = 0,
            }));
});

static string UserIdOrIp(HttpContext httpContext) =>
    httpContext.User.Identity?.IsAuthenticated == true
        ? httpContext.GetUserId().ToString()
        : httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

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
// В "Testing" все запросы идут через один и тот же in-process TestServer с одним "IP" —
// лимиты по IP/пользователю иначе душили бы параллельные тестовые сценарии ложным 429.
if (!app.Environment.IsEnvironment("Testing"))
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

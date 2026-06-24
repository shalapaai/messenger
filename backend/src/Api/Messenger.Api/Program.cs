using System.Text;
using Messenger.Modules.Auth;
using Messenger.Modules.Chats;
using Messenger.Modules.Files;
using Messenger.Modules.Messages;
using Messenger.Modules.Notifications;
using Messenger.Modules.Realtime;
using Messenger.Modules.Users;
using Messenger.Shared.Kernel.Abstractions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// ── Logging ──────────────────────────────────────────────────────────────────
builder.Host.UseSerilog((ctx, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration));

// ── Modules (Composition Root) ───────────────────────────────────────────────
// Каждый модуль сам регистрирует свои зависимости, DbContext, MediatR-хэндлеры
IModuleInstaller[] modules =
[
    new AuthModule(),
    new UsersModule(),
    new ChatsModule(),
    new MessagesModule(),
    new NotificationsModule(),
    new RealtimeModule(),
    new FilesModule()
];

foreach (var module in modules)
    module.Install(builder.Services, builder.Configuration);

// ── Authentication & Authorization ───────────────────────────────────────────
var jwtSettings = builder.Configuration.GetSection("Jwt");
var secretKey = Encoding.UTF8.GetBytes(jwtSettings["SecretKey"]!);

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey         = new SymmetricSecurityKey(secretKey),
            ValidateIssuer           = true,
            ValidIssuer              = jwtSettings["Issuer"],
            ValidateAudience         = true,
            ValidAudience            = jwtSettings["Audience"],
            ValidateLifetime         = true,
            ClockSkew                = TimeSpan.Zero
        };
        // SignalR передаёт токен через query string
        options.Events = new JwtBearerEvents
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

// ── API Infrastructure ────────────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Messenger API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            []
        }
    });
});

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<Messenger.Api.Middleware.GlobalExceptionHandler>();

// ── CORS ─────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? [])
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials())); // AllowCredentials нужен для SignalR

var app = builder.Build();

// ── Middleware Pipeline ───────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors();
app.UseSerilogRequestLogging();
app.UseAuthentication();
app.UseAuthorization();
app.UseExceptionHandler();

// ── Module Endpoints ──────────────────────────────────────────────────────────
app.MapAuthModule();
app.MapUsersModule();
app.MapChatsModule();
app.MapMessagesModule();
app.MapNotificationsModule();
app.MapFilesModule();
app.MapRealtimeModule(); // /hubs/messenger

app.Run();

// Для интеграционных тестов
public partial class Program;

namespace Messenger.Api.Extensions;

using System.Security.Claims;
using System.Text;
using Messenger.Modules.Auth.Application.Abstractions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

public static class AuthenticationExtensions
{
    public static IServiceCollection AddMessengerJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var jwtSection = configuration.GetSection("Jwt");
        var secretKey  = Encoding.UTF8.GetBytes(jwtSection["SecretKey"]!);

        services
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

        services.AddAuthorization();

        return services;
    }
}

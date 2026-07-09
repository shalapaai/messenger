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

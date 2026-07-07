namespace Messenger.Modules.Auth.Presentation;

using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;

internal static class RefreshTokenCookie
{
    public const string Name = "messenger_refresh_token";

    public static void Append(HttpResponse response, string refreshToken, IHostEnvironment environment)
    {
        response.Cookies.Append(
            Name,
            refreshToken,
            CreateOptions(environment, DateTimeOffset.UtcNow.AddDays(7)));
    }

    public static void Delete(HttpResponse response, IHostEnvironment environment)
    {
        response.Cookies.Delete(Name, CreateOptions(environment));
    }

    private static CookieOptions CreateOptions(IHostEnvironment environment, DateTimeOffset? expires = null)
    {
        return new CookieOptions
        {
            HttpOnly = true,
            Secure   = !environment.IsDevelopment(),
            SameSite = environment.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.None,
            Expires  = expires,
            Path     = "/api/auth",
        };
    }
}

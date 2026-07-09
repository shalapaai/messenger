namespace Messenger.Modules.Localization.Middleware;

using System.Globalization;
using Microsoft.AspNetCore.Http;

// Порядок определения культуры:
// 1. Query string: ?lang=ru
// 2. Accept-Language header: Accept-Language: ru-RU,ru;q=0.9
// 3. Default: en
public sealed class RequestCultureMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> SupportedCultures = ["en", "ru"];
    private const string DefaultCulture = "en";

    public async Task InvokeAsync(HttpContext context)
    {
        var culture = DetectCulture(context);

        var cultureInfo = new CultureInfo(culture);
        CultureInfo.CurrentCulture   = cultureInfo;
        CultureInfo.CurrentUICulture = cultureInfo;

        context.Items["RequestCulture"] = culture;

        await next(context);
    }

    private static string DetectCulture(HttpContext context)
    {
        var query = context.Request.Query["lang"].ToString();
        if (!string.IsNullOrEmpty(query) && SupportedCultures.Contains(query))
            return query;

        var acceptLanguage = context.Request.Headers.AcceptLanguage.ToString();
        if (!string.IsNullOrEmpty(acceptLanguage))
        {
            var languages = acceptLanguage
                .Split(',')
                .Select(l => l.Split(';')[0].Trim().Split('-')[0].ToLowerInvariant());

            foreach (var lang in languages)
                if (SupportedCultures.Contains(lang))
                    return lang;
        }

        return DefaultCulture;
    }
}

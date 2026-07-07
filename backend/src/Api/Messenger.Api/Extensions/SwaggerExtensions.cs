namespace Messenger.Api.Extensions;

using Messenger.Api.Middleware;
using Microsoft.OpenApi.Models;

public static class SwaggerExtensions
{
    public static IServiceCollection AddMessengerSwagger(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(opts =>
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
            opts.OperationFilter<SecurityOperationFilter>();
        });

        return services;
    }
}

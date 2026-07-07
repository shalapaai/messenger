namespace Messenger.Api.Middleware;

using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

/// <summary>
/// Добавляет Bearer security только к защищённым эндпойнтам.
/// Глобальный AddSecurityRequirement не используется — иначе замок висит на всех роутах,
/// включая /auth/login, /auth/register и т.д.
/// </summary>
public sealed class SecurityOperationFilter : IOperationFilter
{
    private static readonly OpenApiSecurityRequirement BearerRequirement = new()
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id   = "Bearer"
                }
            },
            []
        }
    };

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var metadata = context.ApiDescription.ActionDescriptor.EndpointMetadata;

        var isAnonymous = metadata.OfType<IAllowAnonymous>().Any();
        if (isAnonymous)
            return;

        var requiresAuth = metadata.OfType<IAuthorizeData>().Any();
        if (requiresAuth)
            operation.Security.Add(BearerRequirement);
    }
}

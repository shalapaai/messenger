namespace Messenger.Api.Middleware;

using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

public sealed class SecurityOperationFilter : IOperationFilter
{
    private static readonly OpenApiSecurityRequirement BearerRequirement = new()
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            []
        }
    };

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var metadata = context.ApiDescription.ActionDescriptor.EndpointMetadata;

        var isAnonymous    = metadata.OfType<IAllowAnonymous>().Any();
        var requiresPolicy = metadata.OfType<AuthorizeAttribute>().Any()
                          || metadata.OfType<IAuthorizeData>().Any();

        if (!isAnonymous || requiresPolicy)
            operation.Security.Add(BearerRequirement);
    }
}

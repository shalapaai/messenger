namespace Messenger.Shared.Kernel.Extensions;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;

public static class ClaimsPrincipalExtensions
{
    // .NET 8+ uses JsonWebTokenHandler with MapInboundClaims = false by default.
    // Claims written as ClaimTypes.* are serialised to short JWT names ("nameid", "email"),
    // and come back unchanged — not remapped to the long ClaimTypes URIs.
    // Fallback chain covers both old (mapped) and new (unmapped) behaviour.

    public static Guid GetUserId(this HttpContext context)
    {
        var claim = context.User.FindFirst(ClaimTypes.NameIdentifier)
            ?? context.User.FindFirst("nameid")
            ?? context.User.FindFirst("sub")
            ?? throw new UnauthorizedAccessException("User ID claim not found");
        return Guid.Parse(claim.Value);
    }

    public static string GetUserEmail(this HttpContext context)
    {
        var claim = context.User.FindFirst(ClaimTypes.Email)
            ?? context.User.FindFirst("email")
            ?? throw new UnauthorizedAccessException("Email claim not found");
        return claim.Value;
    }
}

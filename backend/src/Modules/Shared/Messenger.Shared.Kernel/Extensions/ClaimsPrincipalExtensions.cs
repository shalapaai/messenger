namespace Messenger.Shared.Kernel.Extensions;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this HttpContext context)
    {
        var claim = context.User.FindFirst(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("User ID claim not found");
        return Guid.Parse(claim.Value);
    }

    public static string GetUserEmail(this HttpContext context)
    {
        var claim = context.User.FindFirst(ClaimTypes.Email)
            ?? throw new UnauthorizedAccessException("Email claim not found");
        return claim.Value;
    }
}

using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Data;

namespace WhaleWatching.Api.Auth;

public static class AccessTokenSecurity
{
    public static string StampHash(string? stamp) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(stamp ?? "")));

    public static async Task ValidateAsync(TokenValidatedContext context)
    {
        var sub = context.Principal?.FindFirstValue("sub");
        if (!Guid.TryParse(sub, out var id)) { context.Fail("Invalid account."); return; }
        var db = context.HttpContext.RequestServices.GetRequiredService<WhaleWatchingDbContext>();
        var user = await db.Users.AsNoTracking().Where(x => x.Id == id)
            .Select(x => new { x.SecurityStamp, x.PasswordResetAtUtc }).SingleOrDefaultAsync(context.HttpContext.RequestAborted);
        var claim = context.Principal?.FindFirstValue("sst");
        // Preserve pre-deployment tokens until that account uses recovery. New tokens always carry a stamp.
        if (user is null || (claim is null ? user.PasswordResetAtUtc is not null :
                !Recovery.RecoverySecrets.Equal(claim, StampHash(user.SecurityStamp))))
            context.Fail("Session no longer valid.");
    }
}

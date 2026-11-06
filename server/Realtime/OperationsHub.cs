using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace WhaleWatching.Api.Realtime;

[Authorize]
public sealed class OperationsHub(AccountSessionRegistry sessions, WhaleWatchingDbContext db) : Hub
{
    public override async Task OnConnectedAsync()
    {
        var sub = Context.User?.FindFirstValue("sub") ?? Context.UserIdentifier;
        if (!Guid.TryParse(sub, out var accountId)) { Context.Abort(); return; }
        sessions.Register(accountId, Context.ConnectionId, Context.Abort);
        // Register first, then recheck the marker to close the connect/delete race.
        if (!await db.Users.AnyAsync(x => x.Id == accountId && x.AccountDeletedAtUtc == null, Context.ConnectionAborted))
        { sessions.Remove(accountId, Context.ConnectionId); Context.Abort(); return; }
        foreach (var role in Context.User?.FindAll("role").Select(x => x.Value) ?? [])
            await Groups.AddToGroupAsync(Context.ConnectionId, $"role:{role}");
        var userId = Context.UserIdentifier ?? Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? Context.User?.FindFirst("sub")?.Value;
        if (!string.IsNullOrWhiteSpace(userId))
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        var sub = Context.User?.FindFirstValue("sub") ?? Context.UserIdentifier;
        if (Guid.TryParse(sub, out var id)) sessions.Remove(id, Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}

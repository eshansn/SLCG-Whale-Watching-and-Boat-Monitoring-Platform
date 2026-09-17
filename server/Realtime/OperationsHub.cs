using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace WhaleWatching.Api.Realtime;

[Authorize]
public sealed class OperationsHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        foreach (var role in Context.User?.FindAll("role").Select(x => x.Value) ?? [])
            await Groups.AddToGroupAsync(Context.ConnectionId, $"role:{role}");
        var userId = Context.UserIdentifier ?? Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? Context.User?.FindFirst("sub")?.Value;
        if (!string.IsNullOrWhiteSpace(userId))
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
        await base.OnConnectedAsync();
    }
}

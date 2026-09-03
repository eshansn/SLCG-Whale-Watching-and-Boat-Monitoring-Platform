using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using WhaleWatching.Api.Auth;

namespace WhaleWatching.Api.Gps;

[ApiController]
[Route("api/gps/trackmycar")]
[Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Ops}")]
public sealed class TrackMyCarDiagnosticsController(
    IOptions<TrackMyCarOptions> options,
    TrackMyCarSyncState state) : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status()
    {
        var snapshot = state.Snapshot();
        return Ok(new
        {
            enabled = options.Value.Enabled,
            configured = !string.IsNullOrWhiteSpace(options.Value.ApiKey),
            snapshot.LastSuccessfulSyncUtc,
            snapshot.LastErrorCategory
        });
    }
}

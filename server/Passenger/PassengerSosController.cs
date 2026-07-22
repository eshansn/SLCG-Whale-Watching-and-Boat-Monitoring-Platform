using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Realtime;

namespace WhaleWatching.Api.Passenger;

[ApiController]
[Route("api/passenger/sos")]
[AllowAnonymous]
public sealed class PassengerSosController(WhaleWatchingDbContext db, IHubContext<OperationsHub> hub) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult> Raise(CancellationToken ct)
    {
        var rawToken = Request.Headers["X-Passenger-Session"].ToString();
        if (string.IsNullOrWhiteSpace(rawToken)) return Unauthorized();
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
        var session = await db.PassengerSessions.Include(x => x.Passenger).Include(x => x.Trip)
            .SingleOrDefaultAsync(x => x.TokenHash == tokenHash && x.ExpiresAtUtc > DateTimeOffset.UtcNow, ct);
        if (session is null) return Unauthorized(new { message = "Your passenger session has expired. Please scan the trip QR code again." });
        if (session.Trip.Status is TripStatus.Completed or TripStatus.Cancelled)
            return Conflict(new { message = "An SOS cannot be raised for a completed or cancelled trip." });

        var existing = await db.SosEvents.SingleOrDefaultAsync(x => x.TripId == session.TripId &&
            x.RaisedByUserId == session.PassengerId && x.ResolvedAtUtc == null, ct);
        if (existing is not null) return Ok(new { existing.Id, raisedAtUtc = existing.RaisedAtUtc });

        var sos = new SosEvent { Id = Guid.NewGuid(), TripId = session.TripId,
            RaisedByUserId = session.PassengerId, Message = $"Passenger SOS reported by {session.Passenger.Name}",
            RaisedAtUtc = DateTimeOffset.UtcNow };
        db.SosEvents.Add(sos);
        session.Trip.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "sos", id = sos.Id, tripId = sos.TripId }, ct);
        return Created($"/api/operations/sos/{sos.Id}", new { sos.Id, sos.RaisedAtUtc });
    }
}

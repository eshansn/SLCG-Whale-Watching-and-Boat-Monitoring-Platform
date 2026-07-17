using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Realtime;

namespace WhaleWatching.Api.Operations;

[ApiController]
[Route("api/operations")]
[Authorize]
public sealed class OperationsController(WhaleWatchingDbContext db, IHubContext<OperationsHub> hub) : ControllerBase
{
    [HttpGet("boats")]
    public async Task<ActionResult<IReadOnlyList<BoatDto>>> Boats(CancellationToken ct)
    {
        var query = ScopeBoats(db.Boats.AsNoTracking()).OrderBy(x => x.Name);
        return Ok(await query.Select(x => new BoatDto(x.Id, x.OwnerId, x.Owner.DisplayName, x.Name,
            x.RegistrationNumber, x.RegistrationDate, x.HullNumber, x.LengthMeters, x.WidthMeters,
            x.MaximumCapacity, x.Approval.ToString(), x.ImageUrl)).ToListAsync(ct));
    }

    [HttpGet("trips")]
    public async Task<ActionResult<IReadOnlyList<TripDto>>> Trips(CancellationToken ct)
    {
        var allowedBoats = ScopeBoats(db.Boats).Select(x => x.Id);
        return Ok(await db.Trips.AsNoTracking().Where(x => allowedBoats.Contains(x.BoatId))
            .OrderByDescending(x => x.ScheduledDepartureUtc)
            .Select(x => new TripDto(x.Id, x.BoatId, x.Boat.Name, x.Boat.RegistrationNumber,
                x.Boat.Owner.DisplayName, x.ScheduledDepartureUtc, x.ActualDepartureUtc,
                x.ActualArrivalUtc, x.Route, x.PassengerCount, x.Status.ToString(),
                x.ShoreApproval.ToString(), x.ShoreNotes, x.UpdatedAtUtc)).ToListAsync(ct));
    }

    [HttpPost("boats")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult> CreateBoat(CreateBoatRequest request, CancellationToken ct)
    {
        var boat = new Boat { Id = Guid.NewGuid(), OwnerId = UserId, Name = request.Name.Trim(),
            RegistrationNumber = request.RegistrationNumber.Trim(), RegistrationDate = request.RegistrationDate,
            HullNumber = request.HullNumber.Trim(), LengthMeters = request.LengthMeters,
            WidthMeters = request.WidthMeters, MaximumCapacity = request.MaximumCapacity,
            Approval = ApprovalStatus.Pending, ImageUrl = request.ImageUrl };
        db.Boats.Add(boat);
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "boat", id = boat.Id }, ct);
        return Created($"api/operations/boats/{boat.Id}", new { boat.Id });
    }

    [HttpPost("trips")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult> CreateTrip(CreateTripRequest request, CancellationToken ct)
    {
        if (!await db.Boats.AnyAsync(x => x.Id == request.BoatId && x.OwnerId == UserId, ct)) return Forbid();
        var trip = new Trip { Id = Guid.NewGuid(), BoatId = request.BoatId,
            ScheduledDepartureUtc = request.ScheduledDepartureUtc, Route = request.Route.Trim(),
            PassengerCount = request.PassengerCount, Status = TripStatus.Scheduled,
            ShoreApproval = ApprovalStatus.Pending, UpdatedAtUtc = DateTimeOffset.UtcNow };
        db.Trips.Add(trip); await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "trip", id = trip.Id }, ct);
        return Created($"api/operations/trips/{trip.Id}", new { trip.Id });
    }

    [HttpPatch("trips/{id:guid}/shore-approval")]
    [Authorize(Policy = PortalPolicies.ShoreCrew)]
    public async Task<ActionResult> ApproveTrip(Guid id, ApprovalRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<ApprovalStatus>(request.Approval, true, out var approval) || approval == ApprovalStatus.Pending)
            return ValidationProblem("Approval must be Approved or Rejected.");
        var trip = await db.Trips.FindAsync([id], ct); if (trip is null) return NotFound();
        trip.ShoreApproval = approval; trip.ShoreNotes = request.Notes; trip.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "trip", id }, ct);
        return NoContent();
    }

    [HttpPatch("trips/{id:guid}/status")]
    [Authorize(Roles = $"{PortalRoles.BoatOwner},{PortalRoles.BoatCrew},{PortalRoles.Ops}")]
    public async Task<ActionResult> UpdateStatus(Guid id, StatusRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<TripStatus>(request.Status, true, out var status)) return ValidationProblem("Invalid status.");
        var trip = await db.Trips.Include(x => x.Boat).ThenInclude(x => x.CrewAssignments).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (trip is null) return NotFound();
        if (!User.IsInRole(PortalRoles.Ops) && trip.Boat.OwnerId != UserId && !trip.Boat.CrewAssignments.Any(x => x.CrewUserId == UserId && x.IsActive)) return Forbid();
        trip.Status = status; trip.UpdatedAtUtc = DateTimeOffset.UtcNow;
        if (status == TripStatus.Ongoing) trip.ActualDepartureUtc ??= DateTimeOffset.UtcNow;
        if (status == TripStatus.Completed) trip.ActualArrivalUtc ??= DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct); await hub.Clients.All.SendAsync("operationsChanged", new { entity = "trip", id }, ct);
        return NoContent();
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
    private IQueryable<Boat> ScopeBoats(IQueryable<Boat> query)
    {
        if (User.IsInRole(PortalRoles.BoatOwner)) return query.Where(x => x.OwnerId == UserId);
        if (User.IsInRole(PortalRoles.BoatCrew)) return query.Where(x => x.CrewAssignments.Any(a => a.CrewUserId == UserId && a.IsActive));
        return query;
    }
}

public sealed record BoatDto(Guid Id, Guid OwnerId, string OwnerName, string Name, string RegistrationNumber,
    DateOnly RegistrationDate, string HullNumber, decimal LengthMeters, decimal WidthMeters,
    int MaximumCapacity, string Approval, string? ImageUrl);
public sealed record TripDto(Guid Id, Guid BoatId, string VesselName, string RegistrationNumber, string OwnerName,
    DateTimeOffset ScheduledDepartureUtc, DateTimeOffset? ActualDepartureUtc, DateTimeOffset? ActualArrivalUtc,
    string Route, int PassengerCount, string Status, string ShoreApproval, string? ShoreNotes, DateTimeOffset UpdatedAtUtc);
public sealed record CreateBoatRequest(string Name, string RegistrationNumber, DateOnly RegistrationDate,
    string HullNumber, decimal LengthMeters, decimal WidthMeters, int MaximumCapacity, string? ImageUrl);
public sealed record CreateTripRequest(Guid BoatId, DateTimeOffset ScheduledDepartureUtc, string Route, int PassengerCount);
public sealed record ApprovalRequest(string Approval, string? Notes);
public sealed record StatusRequest(string Status);

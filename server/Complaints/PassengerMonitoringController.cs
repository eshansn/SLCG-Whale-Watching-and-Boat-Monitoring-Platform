using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Complaints;

[ApiController]
[Route("api/passenger-monitoring")]
[Authorize(Policy = PortalPolicies.PassengerMonitoring)]
public sealed class PassengerMonitoringController(WhaleWatchingDbContext db, ComplaintAccess access) : ControllerBase
{
    private async Task<bool> Permitted(CancellationToken ct) => await access.ActorAsync(User, ct) is { Monitor: true };

    [HttpGet("dashboard")]
    public async Task<ActionResult> Dashboard(CancellationToken ct)
    {
        if (!await Permitted(ct)) return Forbid();
        var complaints = db.PassengerComplaints.AsNoTracking();
        var result = new
        {
            Passengers = await db.PassengerProfiles.CountAsync(ct),
            Trips = await db.Trips.CountAsync(ct),
            CompletedTrips = await db.Trips.CountAsync(x => x.Status == TripStatus.Completed, ct),
            Registrations = await db.TripPassengers.CountAsync(ct),
            Complaints = await complaints.CountAsync(x => x.Kind == "Complaint", ct),
            Inquiries = await complaints.CountAsync(x => x.Kind == "Inquiry", ct),
            AwaitingReview = await complaints.CountAsync(x => x.Status == ComplaintStatus.Submitted || x.Status == ComplaintStatus.Reopened, ct),
            AwaitingAcknowledgment = await complaints.CountAsync(x => x.Assignments.Any(a => a.Status == ComplaintAssignmentStatus.Pending), ct),
            AwaitingResponses = await complaints.CountAsync(x => x.Assignments.Any(a => a.Status != ComplaintAssignmentStatus.Responded), ct),
            Resolved = await complaints.CountAsync(x => x.Status == ComplaintStatus.Resolved, ct),
            Closed = await complaints.CountAsync(x => x.Status == ComplaintStatus.Closed, ct),
            RecentActivity = await db.ComplaintEvents.AsNoTracking().OrderByDescending(x => x.CreatedAtUtc).ThenBy(x => x.Id).Take(12)
                .Select(x => new { x.Id, x.ComplaintId, x.Action, x.CreatedAtUtc, Actor = x.ActorUser == null ? "Passenger / legacy record" : x.ActorUser.DisplayName }).ToListAsync(ct)
        };
        return Ok(result);
    }

    [HttpGet("passengers")]
    public async Task<ActionResult> Passengers([FromQuery] MonitoringRecordsQuery query, [FromQuery] string? passengerType, [FromQuery] string? country, CancellationToken ct)
    {
        if (!await Permitted(ct)) return Forbid();
        if (!MonitoringDates.TryBounds(query.From, query.To, out var start, out var end))
            return BadRequest(new { message = "Choose a valid registration date range." });
        var records = db.PassengerProfiles.AsNoTracking();
        if (start is { } first) records = records.Where(x => x.CreatedAtUtc >= first);
        if (end is { } last) records = records.Where(x => x.CreatedAtUtc < last);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            var parsed = Guid.TryParse(search, out var id);
            records = records.Where(x => x.Name.Contains(search) || x.IdentificationNumber.Contains(search) || x.PhoneNumber.Contains(search) || (parsed && x.Id == id));
        }
        if (!string.IsNullOrEmpty(passengerType)) records = records.Where(x => x.PassengerType == passengerType);
        if (!string.IsNullOrEmpty(country)) records = records.Where(x => x.CountryCode == country);
        var total = await records.CountAsync(ct);
        var sorted = query.Sort switch { "name" => records.OrderBy(x => x.Name), "oldest" => records.OrderBy(x => x.CreatedAtUtc),
            "newest" => records.OrderByDescending(x => x.CreatedAtUtc), _ => null };
        if (sorted is null) return BadRequest(new { message = "Invalid passenger sort order." });
        var items = await sorted.ThenBy(x => x.Id).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(x => new { x.Id, x.Name, x.IdentificationNumber, x.PhoneNumber, x.PassengerType, x.CountryCode, x.CreatedAtUtc,
                TripCount = x.Trips.Count, ComplaintCount = x.Complaints.Count(c => c.Kind == "Complaint"), InquiryCount = x.Complaints.Count(c => c.Kind == "Inquiry") }).ToListAsync(ct);
        return Ok(new { Items = items, Total = total, query.Page, query.PageSize });
    }

    [HttpGet("passengers/{id:guid}")]
    public async Task<ActionResult> Passenger(Guid id, CancellationToken ct)
    {
        if (!await Permitted(ct)) return Forbid();
        var record = await db.PassengerProfiles.AsNoTracking().Where(x => x.Id == id)
            .Select(x => new { x.Id, x.Name, x.IdentificationNumber, x.PhoneNumber, x.PassengerType, x.CountryCode, x.Gender, x.AgeCategory,
                x.CreatedAtUtc, TripCount = x.Trips.Count, ComplaintCount = x.Complaints.Count(c => c.Kind == "Complaint"),
                InquiryCount = x.Complaints.Count(c => c.Kind == "Inquiry") }).SingleOrDefaultAsync(ct);
        return record is null ? NotFound() : Ok(record);
    }

    [HttpGet("passengers/{id:guid}/trips")]
    public async Task<ActionResult> PassengerTrips(Guid id, [FromQuery] PageQuery query, CancellationToken ct)
    {
        if (!await Permitted(ct)) return Forbid();
        if (!await db.PassengerProfiles.AnyAsync(x => x.Id == id, ct)) return NotFound();
        var records = db.TripPassengers.AsNoTracking().IgnoreQueryFilters().Where(x => x.PassengerId == id);
        var total = await records.CountAsync(ct);
        var items = await records.OrderByDescending(x => x.RegisteredAtUtc).ThenBy(x => x.Id).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(x => new { x.TripId, x.RegisteredAtUtc, x.Trip.ScheduledDepartureUtc, x.Trip.ActualDepartureUtc, x.Trip.ActualArrivalUtc,
                x.Trip.BoatId, BoatName = x.Trip.Boat.Name, x.Trip.Boat.RegistrationNumber, x.Trip.Route, Status = x.Trip.Status.ToString(),
                Attendance = x.Attendance == null ? "NotChecked" : x.Attendance.Status.ToString() }).ToListAsync(ct);
        return Ok(new { Items = items, Total = total, query.Page, query.PageSize });
    }

    [HttpGet("trips")]
    public async Task<ActionResult> Trips([FromQuery] MonitoringRecordsQuery query, CancellationToken ct)
    {
        if (!await Permitted(ct)) return Forbid();
        if (!MonitoringDates.TryBounds(query.From, query.To, out var start, out var end))
            return BadRequest(new { message = "Choose a valid trip date range." });
        var records = db.Trips.IgnoreQueryFilters().AsNoTracking();
        if (start is { } first) records = records.Where(x => x.ScheduledDepartureUtc >= first);
        if (end is { } last) records = records.Where(x => x.ScheduledDepartureUtc < last);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            var parsed = Guid.TryParse(search, out var id);
            records = records.Where(x => x.Boat.Name.Contains(search) || x.Boat.RegistrationNumber.Contains(search) ||
                x.Route.Contains(search) || (parsed && x.Id == id));
        }
        if (!string.IsNullOrEmpty(query.Status))
        {
            if (!Enum.TryParse<TripStatus>(query.Status, out var status) || !Enum.IsDefined(status))
                return BadRequest(new { message = "Invalid trip status." });
            records = records.Where(x => x.Status == status);
        }
        var total = await records.CountAsync(ct);
        var sorted = query.Sort switch { "newest" => records.OrderByDescending(x => x.ScheduledDepartureUtc),
            "oldest" => records.OrderBy(x => x.ScheduledDepartureUtc), _ => null };
        if (sorted is null) return BadRequest(new { message = "Invalid trip sort order." });
        var items = await sorted.ThenBy(x => x.Id).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(x => new MonitoringTripSummary(x.Id, x.Boat.Name, x.Boat.RegistrationNumber, x.Boat.Owner.DisplayName,
                x.Route, x.ScheduledDepartureUtc, x.ActualDepartureUtc, x.ActualArrivalUtc, x.Status.ToString(), x.Type.ToString(), x.Passengers.Count)).ToListAsync(ct);
        return Ok(new PageResult<MonitoringTripSummary>(items, total, query.Page, query.PageSize));
    }

    [HttpGet("trips/{id:guid}")]
    public async Task<ActionResult> Trip(Guid id, [FromQuery] PageQuery query, CancellationToken ct)
    {
        if (!await Permitted(ct)) return Forbid();
        var trip = await db.Trips.AsNoTracking().IgnoreQueryFilters().Where(x => x.Id == id).Select(x => new
            { x.Id, x.BoatId, BoatName = x.Boat.Name, x.Boat.RegistrationNumber, OwnerName = x.Boat.Owner.DisplayName,
                x.ScheduledDepartureUtc, x.ActualDepartureUtc, x.ActualArrivalUtc, x.Route, Status = x.Status.ToString(), RegisteredPassengers = x.Passengers.Count })
            .SingleOrDefaultAsync(ct);
        if (trip is null) return NotFound();
        var records = db.TripPassengers.AsNoTracking().Where(x => x.TripId == id);
        var items = await records.OrderBy(x => x.Passenger.Name).ThenBy(x => x.Id).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(x => new { x.PassengerId, x.Passenger.Name, x.RegisteredAtUtc, Attendance = x.Attendance == null ? "NotChecked" : x.Attendance.Status.ToString() }).ToListAsync(ct);
        return Ok(new { Trip = trip, Participants = new { Items = items, Total = trip.RegisteredPassengers, query.Page, query.PageSize } });
    }
}

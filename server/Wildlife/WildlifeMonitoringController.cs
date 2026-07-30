using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Realtime;

namespace WhaleWatching.Api.ShoreWildlife;

[ApiController]
[Route("api/shore-wildlife")]
[Authorize(Policy = PortalPolicies.ShoreWildlife)]
public sealed class WildlifeMonitoringController(WhaleWatchingDbContext db, IHubContext<OperationsHub> hub) : ControllerBase
{
    [HttpGet("trips")]
    public async Task<ActionResult<IReadOnlyList<WildlifeTripDto>>> Trips(CancellationToken ct) => Ok(
        await db.Trips.AsNoTracking().OrderByDescending(x => x.ScheduledDepartureUtc)
            .Select(x => new WildlifeTripDto(x.Id, x.Boat.Name, x.Boat.RegistrationNumber,
                x.Boat.Owner.DisplayName, x.ScheduledDepartureUtc, x.Route, x.Status.ToString(),
                x.Passengers.Count, x.ShoreApproval.ToString(), x.WildlifeShoreApproval.ToString(),
                x.Boat.Approval.ToString(), x.Boat.WildlifeApproval.ToString())).ToListAsync(ct));

    [HttpGet("trips/{tripId:guid}/attendance")]
    public async Task<ActionResult<WildlifeAttendanceDto>> Attendance(Guid tripId, CancellationToken ct)
    {
        var result = await BuildAttendance(tripId, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("records")]
    public async Task<ActionResult<IReadOnlyList<WildlifeRecordDto>>> Records(CancellationToken ct)
    {
        var records = await db.WildlifeMonitoringRecords.AsNoTracking().OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(ct);
        return Ok(records.Select(ToDto).ToList());
    }

    [HttpGet("records/{id:guid}")]
    public async Task<ActionResult<WildlifeRecordDto>> Record(Guid id, CancellationToken ct)
    {
        var record = await db.WildlifeMonitoringRecords.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        return record is null ? NotFound() : Ok(ToDto(record));
    }

    [HttpPost("records")]
    public async Task<ActionResult<WildlifeRecordDto>> Create(CreateWildlifeRecordRequest request, CancellationToken ct)
    {
        if (!await db.Trips.AnyAsync(x => x.Id == request.TripId, ct)) return NotFound(new { message = "Trip not found." });
        var now = DateTimeOffset.UtcNow;
        var record = new WildlifeMonitoringRecord { Id = Guid.NewGuid(), TripId = request.TripId,
            CreatedByUserId = UserId, TicketNumber = request.TicketNumber.Trim(), TidNumber = request.TidNumber.Trim(),
            MonitoringOfficer = request.MonitoringOfficer.Trim(), Supervisor = request.Supervisor.Trim(),
            Status = WildlifeMonitoringStatus.Draft, CreatedAtUtc = now, UpdatedAtUtc = now };
        db.WildlifeMonitoringRecords.Add(record); await db.SaveChangesAsync(ct);
        return Created($"/api/wildlife/records/{record.Id}", ToDto(record));
    }

    [HttpPut("records/{id:guid}")]
    public async Task<ActionResult<WildlifeRecordDto>> Update(Guid id, UpdateWildlifeRecordRequest request, CancellationToken ct)
    {
        var record = await db.WildlifeMonitoringRecords.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (record is null) return NotFound();
        if (record.Status == WildlifeMonitoringStatus.Completed) return Conflict(new { message = "Completed records are read-only." });
        record.TicketNumber = request.TicketNumber.Trim(); record.TidNumber = request.TidNumber.Trim();
        record.MonitoringOfficer = request.MonitoringOfficer.Trim(); record.Supervisor = request.Supervisor.Trim();
        record.Status = WildlifeMonitoringStatus.PendingHarbourSignature; record.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct); return Ok(ToDto(record));
    }

    [HttpPost("records/{id:guid}/sign")]
    public async Task<ActionResult<WildlifeRecordDto>> Sign(Guid id, SignWildlifeRecordRequest request, CancellationToken ct)
    {
        var record = await db.WildlifeMonitoringRecords.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (record is null) return NotFound();
        if (record.Status == WildlifeMonitoringStatus.Completed && record.MonitoringOfficerSignature != null &&
            record.SupervisorSignature != null && record.HarbourOfficerSignature != null)
            return Conflict(new { message = "This record has already been signed by all required officers." });
        if (!ValidSignature(request.MonitoringOfficerSignature) || !ValidSignature(request.SupervisorSignature) ||
            !ValidSignature(request.HarbourOfficerSignature))
            return ValidationProblem("Valid Monitoring Officer, Supervisor, and Harbour Officer PNG signatures are required.");
        var attendance = await BuildAttendance(record.TripId, ct);
        if (attendance is null) return NotFound(new { message = "Trip not found." });
        record.LocalAdultSnapshot = attendance.Local.Adult; record.LocalChildSnapshot = attendance.Local.Child;
        record.LocalSmallSnapshot = attendance.Local.Small; record.ForeignAdultSnapshot = attendance.Foreign.Adult;
        record.ForeignChildSnapshot = attendance.Foreign.Child; record.ForeignSmallSnapshot = attendance.Foreign.Small;
        record.MonitoringOfficerSignature = request.MonitoringOfficerSignature;
        record.SupervisorSignature = request.SupervisorSignature;
        record.HarbourOfficerName = request.HarbourOfficerName.Trim();
        record.HarbourOfficerSignature = request.HarbourOfficerSignature;
        record.Status = WildlifeMonitoringStatus.Completed; record.SignedAtUtc = record.CompletedAtUtc = record.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await hub.Clients.Group($"role:{PortalRoles.ShoreWildlife}").SendAsync("wildlifeRecordChanged", new { record.Id, record.TripId }, ct);
        return Ok(ToDto(record));
    }

    [HttpPatch("trips/{tripId:guid}/approval")]
    public async Task<ActionResult<WildlifeTripDto>> Approve(Guid tripId, WildlifeApprovalRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<ApprovalStatus>(request.Approval, true, out var approval) || approval == ApprovalStatus.Pending)
            return ValidationProblem("Approval must be Approved or Rejected.");
        var trip = await db.Trips.Include(x => x.Boat).ThenInclude(x => x.Owner).SingleOrDefaultAsync(x => x.Id == tripId, ct);
        if (trip is null) return NotFound();
        if (approval == ApprovalStatus.Approved)
        {
            var validRecord = await db.WildlifeMonitoringRecords.AsNoTracking().AnyAsync(x => x.TripId == tripId &&
                x.Status == WildlifeMonitoringStatus.Completed && x.TicketNumber != "" && x.TidNumber != "" &&
                x.MonitoringOfficer != "" && x.Supervisor != "" && x.MonitoringOfficerSignature != null &&
                x.SupervisorSignature != null && x.HarbourOfficerSignature != null && x.HarbourOfficerName != null, ct);
            if (!validRecord) return Conflict(new { message = "Complete all monitoring information and obtain all three signatures before approval." });
            if (trip.Boat.Approval != ApprovalStatus.Approved && trip.Boat.WildlifeApproval != ApprovalStatus.Approved)
                return Conflict(new { message = "The boat must be approved by an administrator or the main Wildlife portal first." });
        }
        trip.WildlifeShoreApproval = approval; trip.WildlifeShoreNotes = request.Notes?.Trim();
        trip.UpdatedAtUtc = DateTimeOffset.UtcNow; await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "wildlifeShoreApproval", tripId }, ct);
        return Ok(new WildlifeTripDto(trip.Id, trip.Boat.Name, trip.Boat.RegistrationNumber,
            trip.Boat.Owner.DisplayName, trip.ScheduledDepartureUtc, trip.Route, trip.Status.ToString(),
            await db.TripPassengers.CountAsync(x => x.TripId == tripId, ct), trip.ShoreApproval.ToString(),
            trip.WildlifeShoreApproval.ToString(), trip.Boat.Approval.ToString(), trip.Boat.WildlifeApproval.ToString()));
    }

    private async Task<WildlifeAttendanceDto?> BuildAttendance(Guid tripId, CancellationToken ct)
    {
        var trip = await db.Trips.AsNoTracking().Where(x => x.Id == tripId).Select(x => new { x.Id,
            BoatName = x.Boat.Name, x.Boat.RegistrationNumber, OwnerName = x.Boat.Owner.DisplayName,
            x.ScheduledDepartureUtc, x.Route, Status = x.Status.ToString(),
            ShoreApproval = x.ShoreApproval.ToString(), WildlifeShoreApproval = x.WildlifeShoreApproval.ToString(),
            CertificationApproval = x.Boat.Approval.ToString(), BoatWildlifeApproval = x.Boat.WildlifeApproval.ToString() }).SingleOrDefaultAsync(ct);
        if (trip is null) return null;
        var rows = await db.TripPassengers.AsNoTracking().Where(x => x.TripId == tripId &&
                x.Attendance != null && x.Attendance.Status == PassengerAttendanceStatus.Present)
            .Select(x => new { Nationality = x.Passenger.PassengerType, Type = x.Passenger.AgeCategory,
                Updated = x.Attendance!.UpdatedAtUtc }).ToListAsync(ct);
        CountDto Count(string nationality) => new(
            rows.Count(x => Eq(x.Nationality, nationality) && (Eq(x.Type, "adult") || Eq(x.Type, "specialneeds"))),
            rows.Count(x => Eq(x.Nationality, nationality) && Eq(x.Type, "child")),
            rows.Count(x => Eq(x.Nationality, nationality) && Eq(x.Type, "small")));
        var local = Count("local"); var foreign = Count("foreign");
        return new WildlifeAttendanceDto(trip.Id, trip.BoatName, trip.RegistrationNumber, trip.OwnerName,
            trip.ScheduledDepartureUtc, trip.Route, trip.Status, trip.ShoreApproval, trip.WildlifeShoreApproval,
            trip.CertificationApproval, trip.BoatWildlifeApproval, local, foreign, local.Total + foreign.Total,
            rows.Count == 0 ? DateTimeOffset.UtcNow : rows.Max(x => x.Updated));
    }

    private static bool Eq(string value, string expected) => string.Equals(value, expected, StringComparison.OrdinalIgnoreCase);
    private static bool ValidSignature(string value) => value.StartsWith("data:image/png;base64,", StringComparison.Ordinal) && value.Length <= 500000;
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
    private static WildlifeRecordDto ToDto(WildlifeMonitoringRecord x) => new(x.Id, x.TripId, x.TicketNumber,
        x.TidNumber, x.MonitoringOfficer, x.Supervisor, x.Status.ToString(), new CountDto(x.LocalAdultSnapshot,
        x.LocalChildSnapshot, x.LocalSmallSnapshot), new CountDto(x.ForeignAdultSnapshot, x.ForeignChildSnapshot,
        x.ForeignSmallSnapshot), x.LocalAdultSnapshot + x.LocalChildSnapshot + x.LocalSmallSnapshot +
        x.ForeignAdultSnapshot + x.ForeignChildSnapshot + x.ForeignSmallSnapshot, x.HarbourOfficerName,
        x.SignedAtUtc, x.CreatedAtUtc, x.CompletedAtUtc, x.MonitoringOfficerSignature,
        x.SupervisorSignature, x.HarbourOfficerSignature);
}

public sealed record WildlifeTripDto(Guid Id, string BoatName, string RegistrationNumber, string OwnerName,
    DateTimeOffset ScheduledDepartureUtc, string Route, string Status, int RegisteredPassengers,
    string ShoreApproval, string WildlifeShoreApproval, string CertificationApproval, string BoatWildlifeApproval);
public sealed record CountDto(int Adult, int Child, int Small) { public int Total => Adult + Child + Small; }
public sealed record WildlifeAttendanceDto(Guid TripId, string BoatName, string RegistrationNumber, string OwnerName,
    DateTimeOffset ScheduledDepartureUtc, string Route, string TripStatus, string ShoreApproval,
    string WildlifeShoreApproval, string CertificationApproval, string BoatWildlifeApproval, CountDto Local, CountDto Foreign,
    int TotalPresent, DateTimeOffset LastUpdatedUtc);
public sealed record WildlifeRecordDto(Guid Id, Guid TripId, string TicketNumber, string TidNumber,
    string MonitoringOfficer, string Supervisor, string Status, CountDto Local, CountDto Foreign, int TotalPresent,
    string? HarbourOfficerName, DateTimeOffset? SignedAtUtc, DateTimeOffset CreatedAtUtc, DateTimeOffset? CompletedAtUtc,
    string? MonitoringOfficerSignature, string? SupervisorSignature, string? HarbourOfficerSignature);
public sealed record CreateWildlifeRecordRequest(Guid TripId,
    [param: Required, MaxLength(80)] string TicketNumber, [param: Required, MaxLength(80)] string TidNumber,
    [param: Required, MaxLength(160)] string MonitoringOfficer, [param: Required, MaxLength(160)] string Supervisor);
public sealed record UpdateWildlifeRecordRequest([param: Required, MaxLength(80)] string TicketNumber,
    [param: Required, MaxLength(80)] string TidNumber, [param: Required, MaxLength(160)] string MonitoringOfficer,
    [param: Required, MaxLength(160)] string Supervisor);
public sealed record SignWildlifeRecordRequest([param: Required, MaxLength(160)] string HarbourOfficerName,
    [param: Required] string MonitoringOfficerSignature, [param: Required] string SupervisorSignature,
    [param: Required] string HarbourOfficerSignature);
public sealed record WildlifeApprovalRequest([param: Required] string Approval, [param: MaxLength(1000)] string? Notes);

using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Realtime;

namespace WhaleWatching.Api.Passenger;

[ApiController]
[Route("api/shore/trips/{tripId:guid}/attendance")]
[Authorize(Policy = PortalPolicies.ShoreCrew)]
public sealed class PassengerAttendanceController(WhaleWatchingDbContext db,
    IHubContext<OperationsHub> hub) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<TripAttendanceDto>> Manifest(Guid tripId, CancellationToken ct)
    {
        var result = await BuildManifest(tripId, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("scan")]
    public async Task<ActionResult<PassengerGroupDto>> Scan(Guid tripId, ScanPassengerQrRequest request,
        CancellationToken ct)
    {
        var trip = await db.Trips.AsNoTracking().SingleOrDefaultAsync(x => x.Id == tripId, ct);
        if (trip is null) return NotFound(new { message = "The selected trip was not found." });
        if (trip.Status is not (TripStatus.Scheduled or TripStatus.Boarding))
            return Conflict(new { message = "Passenger boarding is not available for this trip." });
        var token = ParseQrValue(request.QrValue);
        if (token is null) return BadRequest(new { message = "Invalid passenger QR code. Please ask the passenger to present a valid registration QR code." });
        var primary = await db.PassengerProfiles.AsNoTracking().SingleOrDefaultAsync(x => x.PersonalQrToken == token, ct);
        if (primary is null) return NotFound(new { message = "Invalid passenger QR code. Please ask the passenger to present a valid registration QR code." });
        var group = await BuildGroup(tripId, primary.Id, ct);
        if (group is not null) return Ok(group);
        var registeredElsewhere = await db.TripPassengers.AnyAsync(x => x.PrimaryPassengerId == primary.Id, ct);
        return registeredElsewhere
            ? Conflict(new { message = "This passenger is registered for a different scheduled trip." })
            : NotFound(new { message = "This passenger is not registered for the selected trip." });
    }

    [HttpGet("groups/{primaryPassengerId:guid}")]
    public async Task<ActionResult<PassengerGroupDto>> Group(Guid tripId, Guid primaryPassengerId, CancellationToken ct)
    {
        var group = await BuildGroup(tripId, primaryPassengerId, ct);
        return group is null ? NotFound(new { message = "Passenger group not found for this trip." }) : Ok(group);
    }

    [HttpGet("search")]
    public async Task<ActionResult<IReadOnlyList<PassengerGroupSearchDto>>> Search(Guid tripId,
        [FromQuery] string? query, CancellationToken ct)
    {
        if (!await db.Trips.AnyAsync(x => x.Id == tripId, ct)) return NotFound();
        var term = query?.Trim() ?? string.Empty;
        if (term.Length < 2) return Ok(Array.Empty<PassengerGroupSearchDto>());
        if (term.Length > 100) return BadRequest(new { message = "Passenger search is too long." });
        var normalized = term.ToUpperInvariant();
        return Ok(await db.TripPassengers.AsNoTracking().Where(x => x.TripId == tripId &&
                x.PassengerId == x.PrimaryPassengerId &&
                (x.Passenger.Name.ToUpper().Contains(normalized) ||
                 x.Passenger.IdentificationNumber.ToUpper().Contains(normalized) ||
                 x.PassengerId.ToString().Contains(term)))
            .OrderBy(x => x.Passenger.Name).Take(10)
            .Select(x => new PassengerGroupSearchDto(x.PrimaryPassengerId, x.Passenger.Name,
                x.Passenger.IdentificationNumber,
                db.TripPassengers.Count(member => member.TripId == tripId &&
                    member.PrimaryPassengerId == x.PrimaryPassengerId),
                db.TripPassengers.Any(member => member.TripId == tripId &&
                    member.PrimaryPassengerId == x.PrimaryPassengerId && member.Attendance != null &&
                    member.Attendance.Status != PassengerAttendanceStatus.NotChecked)))
            .ToListAsync(ct));
    }

    [HttpPut("groups/{primaryPassengerId:guid}")]
    public async Task<ActionResult<PassengerGroupDto>> SaveGroup(Guid tripId, Guid primaryPassengerId,
        SaveAttendanceRequest request, CancellationToken ct)
    {
        if (request.Items.Count == 0 || request.Items.Count != request.Items.Select(x => x.PassengerId).Distinct().Count())
            return BadRequest(new { message = "Submit one attendance status for every passenger in the group." });
        var parsed = new Dictionary<Guid, PassengerAttendanceStatus>();
        foreach (var item in request.Items)
        {
            if (!Enum.TryParse<PassengerAttendanceStatus>(item.Status, true, out var status))
                return BadRequest(new { message = "Attendance status must be NotChecked, Present, or NotPresent." });
            parsed[item.PassengerId] = status;
        }
        var strategy = db.Database.CreateExecutionStrategy();
        var action = await strategy.ExecuteAsync<ActionResult>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var trip = await db.Trips.SingleOrDefaultAsync(x => x.Id == tripId, ct);
            if (trip is null) return NotFound();
            if (trip.PassengerVerificationFinalizedAtUtc is not null)
                return Conflict(new { message = "Passenger verification has been finalized for this trip." });
            if (trip.Status is not (TripStatus.Scheduled or TripStatus.Boarding))
                return Conflict(new { message = "Passenger boarding is not available for this trip." });
            var registrations = await db.TripPassengers.Include(x => x.Attendance).Where(x =>
                x.TripId == tripId && x.PrimaryPassengerId == primaryPassengerId).ToListAsync(ct);
            if (registrations.Count == 0) return NotFound(new { message = "Passenger group not found for this trip." });
            if (registrations.Count != parsed.Count || registrations.Any(x => !parsed.ContainsKey(x.PassengerId)))
                return BadRequest(new { message = "Submit one attendance status for every passenger in the group." });
            var now = DateTimeOffset.UtcNow;
            foreach (var registration in registrations)
            {
                var next = parsed[registration.PassengerId];
                var previous = registration.Attendance?.Status ?? PassengerAttendanceStatus.NotChecked;
                if (registration.Attendance is null && next == PassengerAttendanceStatus.NotChecked) continue;
                if (registration.Attendance is null)
                {
                    registration.Attendance = new TripPassengerAttendance { Id = Guid.NewGuid(),
                        TripPassengerId = registration.Id, Status = next, CheckedByUserId = UserId,
                        CheckedAtUtc = next == PassengerAttendanceStatus.Present ? now : null, UpdatedAtUtc = now };
                    db.TripPassengerAttendances.Add(registration.Attendance);
                }
                else
                {
                    registration.Attendance.Status = next;
                    registration.Attendance.CheckedByUserId = UserId;
                    registration.Attendance.CheckedAtUtc = next == PassengerAttendanceStatus.Present
                        ? registration.Attendance.CheckedAtUtc ?? now : null;
                    registration.Attendance.UpdatedAtUtc = now;
                }
                if (previous != next)
                    db.PassengerAttendanceAudits.Add(new PassengerAttendanceAudit { Id = Guid.NewGuid(),
                        Attendance = registration.Attendance, PreviousStatus = previous, NewStatus = next,
                        ChangedByUserId = UserId, ChangedAtUtc = now });
            }
            await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
            return Ok();
        });
        if (action is not OkResult) return action;
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "passengerAttendance", tripId }, ct);
        return Ok(await BuildGroup(tripId, primaryPassengerId, ct));
    }

    [HttpPost("finalize")]
    public async Task<ActionResult<TripAttendanceDto>> Finalize(Guid tripId,
        FinalizeAttendanceRequest request, CancellationToken ct)
    {
        var trip = await db.Trips.SingleOrDefaultAsync(x => x.Id == tripId, ct);
        if (trip is null) return NotFound();
        if (trip.PassengerVerificationFinalizedAtUtc is not null)
            return Conflict(new { message = "Passenger verification has already been finalized." });
        if (trip.Status is not (TripStatus.Scheduled or TripStatus.Boarding))
            return Conflict(new { message = "Passenger verification cannot be finalized for this trip." });
        var total = await db.TripPassengers.CountAsync(x => x.TripId == tripId, ct);
        var checkedCount = await db.TripPassengerAttendances.CountAsync(x =>
            x.TripPassenger.TripId == tripId && x.Status != PassengerAttendanceStatus.NotChecked, ct);
        if (checkedCount < total && !request.ConfirmIncomplete)
            return Conflict(new { message = $"{total - checkedCount} passengers have not been checked yet. Confirm incomplete verification to continue." });
        trip.PassengerVerificationFinalizedAtUtc = DateTimeOffset.UtcNow;
        trip.PassengerVerificationFinalizedByUserId = UserId;
        trip.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "passengerAttendanceFinalized", tripId }, ct);
        return Ok(await BuildManifest(tripId, ct));
    }

    [HttpGet("audit")]
    public async Task<ActionResult<IReadOnlyList<AttendanceAuditDto>>> Audit(Guid tripId, CancellationToken ct) =>
        Ok(await db.PassengerAttendanceAudits.AsNoTracking().Where(x => x.Attendance.TripPassenger.TripId == tripId)
            .OrderByDescending(x => x.ChangedAtUtc).Take(100).Select(x => new AttendanceAuditDto(
                x.Attendance.TripPassenger.PassengerId, x.Attendance.TripPassenger.Passenger.Name,
                x.PreviousStatus.ToString(), x.NewStatus.ToString(), x.ChangedByUser.DisplayName,
                x.ChangedAtUtc)).ToListAsync(ct));

    private async Task<PassengerGroupDto?> BuildGroup(Guid tripId, Guid primaryPassengerId, CancellationToken ct)
    {
        var primary = await db.PassengerProfiles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == primaryPassengerId, ct);
        if (primary is null) return null;
        var members = await db.TripPassengers.AsNoTracking().Where(x => x.TripId == tripId &&
                x.PrimaryPassengerId == primaryPassengerId).OrderByDescending(x => x.PassengerId == primaryPassengerId)
            .ThenBy(x => x.Passenger.Name).Select(x => new AttendancePassengerDto(x.PassengerId,
                x.Passenger.Name, x.Passenger.IdentificationNumber, x.Passenger.PhoneNumber,
                x.PassengerId == primaryPassengerId ? "Primary Passenger" : "Group Member",
                x.Attendance == null ? PassengerAttendanceStatus.NotChecked.ToString() : x.Attendance.Status.ToString(),
                x.Attendance == null ? null : x.Attendance.CheckedAtUtc,
                x.Attendance == null ? null : x.Attendance.UpdatedAtUtc)).ToListAsync(ct);
        if (members.Count == 0) return null;
        var trip = await db.Trips.AsNoTracking().Where(x => x.Id == tripId).Select(x => new {
            x.Id, x.Boat.Name, x.Boat.RegistrationNumber, x.ScheduledDepartureUtc,
            Finalized = x.PassengerVerificationFinalizedAtUtc != null }).SingleAsync(ct);
        return new PassengerGroupDto(primaryPassengerId, primary.Name, primary.IdentificationNumber,
            trip.Id, trip.Name, trip.RegistrationNumber, trip.ScheduledDepartureUtc,
            members.Any(x => x.Status != PassengerAttendanceStatus.NotChecked.ToString()),
            trip.Finalized, members);
    }

    private async Task<TripAttendanceDto?> BuildManifest(Guid tripId, CancellationToken ct)
    {
        var trip = await db.Trips.AsNoTracking().Where(x => x.Id == tripId).Select(x => new {
            x.Id, BoatName = x.Boat.Name, x.Boat.RegistrationNumber, x.ScheduledDepartureUtc,
            Status = x.Status.ToString(), x.PassengerVerificationFinalizedAtUtc,
            FinalizedBy = x.PassengerVerificationFinalizedByUser == null ? null : x.PassengerVerificationFinalizedByUser.DisplayName
        }).SingleOrDefaultAsync(ct);
        if (trip is null) return null;
        var passengers = await db.TripPassengers.AsNoTracking().Where(x => x.TripId == tripId)
            .OrderBy(x => x.PrimaryPassenger.Name).ThenByDescending(x => x.PassengerId == x.PrimaryPassengerId)
            .ThenBy(x => x.Passenger.Name).Select(x => new AttendancePassengerDto(x.PassengerId,
                x.Passenger.Name, x.Passenger.IdentificationNumber, x.Passenger.PhoneNumber,
                x.PassengerId == x.PrimaryPassengerId ? "Primary Passenger" : $"{x.PrimaryPassenger.Name}'s Group",
                x.Attendance == null ? PassengerAttendanceStatus.NotChecked.ToString() : x.Attendance.Status.ToString(),
                x.Attendance == null ? null : x.Attendance.CheckedAtUtc,
                x.Attendance == null ? null : x.Attendance.UpdatedAtUtc)).ToListAsync(ct);
        var present = passengers.Count(x => x.Status == PassengerAttendanceStatus.Present.ToString());
        var absent = passengers.Count(x => x.Status == PassengerAttendanceStatus.NotPresent.ToString());
        return new TripAttendanceDto(trip.Id, trip.BoatName, trip.RegistrationNumber,
            trip.ScheduledDepartureUtc, trip.Status, trip.PassengerVerificationFinalizedAtUtc,
            trip.FinalizedBy, new AttendanceSummaryDto(present, absent,
                passengers.Count - present - absent, passengers.Count), passengers);
    }

    private static string? ParseQrValue(string value)
    {
        var clean = value.Trim();
        const string prefix = "wwms:passenger:";
        if (clean.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) clean = clean[prefix.Length..];
        return clean.Length is >= 32 and <= 64 && clean.All(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_')
            ? clean : null;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
}

public sealed class ScanPassengerQrRequest
{
    [Required, MaxLength(256)] public required string QrValue { get; init; }
}
public sealed class SaveAttendanceRequest
{
    [MinLength(1), MaxLength(500)] public IReadOnlyList<AttendanceUpdateItem> Items { get; init; } = [];
}
public sealed record AttendanceUpdateItem(Guid PassengerId, string Status);
public sealed record FinalizeAttendanceRequest(bool ConfirmIncomplete = false);
public sealed record AttendanceSummaryDto(int Present, int NotPresent, int NotChecked, int Total);
public sealed record AttendancePassengerDto(Guid PassengerId, string Name, string PassengerReference,
    string PhoneNumber, string Relationship, string Status, DateTimeOffset? CheckedAtUtc,
    DateTimeOffset? UpdatedAtUtc);
public sealed record PassengerGroupDto(Guid PrimaryPassengerId, string PrimaryPassengerName,
    string PrimaryPassengerReference, Guid TripId, string BoatName, string RegistrationNumber,
    DateTimeOffset ScheduledDepartureUtc, bool AlreadyProcessed, bool Finalized,
    IReadOnlyList<AttendancePassengerDto> Members);
public sealed record PassengerGroupSearchDto(Guid PrimaryPassengerId, string PrimaryPassengerName,
    string PassengerReference, int MemberCount, bool AlreadyProcessed);
public sealed record TripAttendanceDto(Guid TripId, string BoatName, string RegistrationNumber,
    DateTimeOffset ScheduledDepartureUtc, string TripStatus, DateTimeOffset? FinalizedAtUtc,
    string? FinalizedBy, AttendanceSummaryDto Summary, IReadOnlyList<AttendancePassengerDto> Passengers);
public sealed record AttendanceAuditDto(Guid PassengerId, string PassengerName, string PreviousStatus,
    string NewStatus, string ChangedBy, DateTimeOffset ChangedAtUtc);

using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Operations;
using WhaleWatching.Api.Realtime;

namespace WhaleWatching.Api.ShoreWildlife;

[ApiController]
[Route("api/shore-wildlife")]
[Authorize(Policy = PortalPolicies.ShoreWildlife)]
public sealed class WildlifeMonitoringController(WhaleWatchingDbContext db, IHubContext<OperationsHub> hub) : ControllerBase
{
    [HttpGet("trips")]
    public async Task<ActionResult<IReadOnlyList<WildlifeTripDto>>> Trips(CancellationToken ct)
    {
        var currentSriLankaDayStartUtc = TripWorkflowRules.GetSriLankaDayStartUtc(DateTimeOffset.UtcNow);
        var trips = await db.Trips.AsNoTracking()
            .Where(x => x.Status != TripStatus.Completed && x.Status != TripStatus.Cancelled &&
                x.Status != TripStatus.Declined &&
                ((x.Status != TripStatus.Scheduled && x.Status != TripStatus.Boarding) ||
                 x.ScheduledDepartureUtc >= currentSriLankaDayStartUtc))
            .OrderByDescending(x => x.ScheduledDepartureUtc)
            .Select(x => new WildlifeTripDto(x.Id, x.Boat.Name, x.Boat.RegistrationNumber,
                x.Boat.Owner.DisplayName, x.ScheduledDepartureUtc, x.Route, x.Status.ToString(),
                x.Passengers.Count, db.WildlifeMonitoringRecords.Where(r => r.TripId == x.Id)
                    .Select(r => r.Status.ToString()).FirstOrDefault() ?? WildlifeMonitoringStatus.Draft.ToString(), x.BoatId, null)).ToListAsync(ct);
        var boatIds = trips.Select(x => x.BoatId).ToArray();
        var images = await BoatDisplayImage.GetUrlsAsync(db.BoatDocuments.AsNoTracking()
            .Where(x => boatIds.Contains(x.BoatId)), ct);
        return Ok(trips.Select(trip => trip with { ImageUrl = images.GetValueOrDefault(trip.BoatId) }));
    }

    [HttpGet("trips/{tripId:guid}/attendance")]
    public async Task<ActionResult<WildlifeAttendanceDto>> Attendance(Guid tripId, CancellationToken ct)
    {
        var result = await BuildAttendance(tripId, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("records")]
    public async Task<ActionResult<IReadOnlyList<WildlifeRecordDto>>> Records(CancellationToken ct)
    {
        var records = await RecordsWithSignatureRequests().OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct);
        return Ok(records.Select(ToDto).ToList());
    }

    [HttpGet("records/{id:guid}")]
    public async Task<ActionResult<WildlifeRecordDto>> Record(Guid id, CancellationToken ct)
    {
        var record = await RecordsWithSignatureRequests().SingleOrDefaultAsync(x => x.Id == id, ct);
        return record is null ? NotFound() : Ok(ToDto(record));
    }

    [HttpPost("records")]
    public async Task<ActionResult<WildlifeRecordDto>> Create(CreateWildlifeRecordRequest request, CancellationToken ct)
    {
        var existing = await RecordsWithSignatureRequests()
            .SingleOrDefaultAsync(x => x.TripId == request.TripId, ct);
        if (existing is not null) return Ok(ToDto(existing));
        if (!await db.Trips.AnyAsync(x => x.Id == request.TripId, ct)) return NotFound(new { message = "Trip not found." });
        var now = DateTimeOffset.UtcNow;
        var record = new WildlifeMonitoringRecord { Id = Guid.NewGuid(), TripId = request.TripId,
            CreatedByUserId = UserId, TicketNumber = request.TicketNumber.Trim(), TidNumber = request.TidNumber.Trim(),
            MonitoringOfficer = request.MonitoringOfficer.Trim(), Supervisor = string.Empty,
            UsesSignatureRequestWorkflow = true,
            Status = WildlifeMonitoringStatus.Draft, CreatedAtUtc = now, UpdatedAtUtc = now };
        db.WildlifeMonitoringRecords.Add(record);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            db.Entry(record).State = EntityState.Detached;
            existing = await RecordsWithSignatureRequests()
                .SingleOrDefaultAsync(x => x.TripId == request.TripId, ct);
            if (existing is not null) return Ok(ToDto(existing));
            throw;
        }
        var created = await RecordsWithSignatureRequests()
            .SingleAsync(x => x.Id == record.Id, ct);
        return Created($"/api/shore-wildlife/records/{record.Id}", ToDto(created));
    }

    [HttpPut("records/{id:guid}")]
    public async Task<ActionResult<WildlifeRecordDto>> Update(Guid id, UpdateWildlifeRecordRequest request, CancellationToken ct)
    {
        var record = await RecordsWithSignatureRequests(tracking: true)
            .SingleOrDefaultAsync(x => x.Id == id, ct);
        if (record is null) return NotFound();
        if (record.Status is WildlifeMonitoringStatus.Completed or WildlifeMonitoringStatus.Discarded)
            return Conflict(new { message = "Completed or discarded records are read-only." });
        if (!SignatureRequestRules.CanEditMonitoringDetails(record))
            return Conflict(new { message = "Monitoring details cannot be changed after an officer has signed." });
        record.TicketNumber = request.TicketNumber.Trim(); record.TidNumber = request.TidNumber.Trim();
        record.MonitoringOfficer = request.MonitoringOfficer.Trim();
        record.Status = record.UsesSignatureRequestWorkflow
            ? WildlifeMonitoringStatus.PendingSignatures : WildlifeMonitoringStatus.PendingHarbourSignature;
        record.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct); return Ok(ToDto(record));
    }

    [HttpPost("records/{id:guid}/sign")]
    public async Task<ActionResult<WildlifeRecordDto>> Sign(Guid id, SignWildlifeRecordRequest request, CancellationToken ct)
    {
        var record = await RecordsWithSignatureRequests(tracking: true).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (record is null) return NotFound();
        if (record.Status is WildlifeMonitoringStatus.Completed or WildlifeMonitoringStatus.Discarded)
            return Conflict(new { message = "Completed or discarded records are read-only." });
        if (!record.UsesSignatureRequestWorkflow)
            return Conflict(new { message = "This legacy record uses its original signature workflow." });
        if (record.MonitoringOfficerSignature is not null)
            return Conflict(new { message = "The Monitoring Officer signature has already been issued and cannot be changed." });
        if (!ValidSignature(request.MonitoringOfficerSignature))
            return ValidationProblem("A valid Monitoring Officer PNG signature is required.");
        var attendance = await BuildAttendance(record.TripId, ct);
        if (attendance is null) return NotFound(new { message = "Trip not found." });
        record.LocalAdultSnapshot = attendance.Local.Adult; record.LocalChildSnapshot = attendance.Local.Child;
        record.LocalSmallSnapshot = attendance.Local.Small; record.ForeignAdultSnapshot = attendance.Foreign.Adult;
        record.ForeignChildSnapshot = attendance.Foreign.Child; record.ForeignSmallSnapshot = attendance.Foreign.Small;
        record.MonitoringOfficerSignature = request.MonitoringOfficerSignature;
        record.MonitoringOfficerSignedAtUtc = DateTimeOffset.UtcNow;
        record.Status = WildlifeMonitoringStatus.PendingSignatures;
        record.UpdatedAtUtc = DateTimeOffset.UtcNow;
        var signedTypes = record.SignatureRequests.Where(x => x.Status == WildlifeSignatureRequestStatus.Signed)
            .Select(x => x.SignatureType).Distinct().ToHashSet();
        if (signedTypes.Contains(WildlifeSignatureType.Supervisor) &&
            signedTypes.Contains(WildlifeSignatureType.HarbourOfficer))
            record.SignedAtUtc = record.UpdatedAtUtc;
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("wildlifeRecordChanged", new { record.Id, record.TripId }, ct);
        return Ok(ToDto(record));
    }

    [HttpPost("records/{id:guid}/confirm")]
    public async Task<ActionResult<WildlifeRecordDto>> Confirm(Guid id, CancellationToken ct)
    {
        var record = await RecordsWithSignatureRequests(tracking: true).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (record is null) return NotFound();
        if (record.Status == WildlifeMonitoringStatus.Discarded)
            return Conflict(new { message = "A discarded monitoring record cannot be confirmed." });
        if (!SignatureRequestRules.HasRequiredSignatures(record))
            return Conflict(new { message = record.UsesSignatureRequestWorkflow
                ? "Waiting for required Monitoring Officer, Supervisor, and Harbour Officer signatures."
                : "Complete the legacy monitoring record and all signatures before confirming it." });
        var now = DateTimeOffset.UtcNow;
        record.Status = WildlifeMonitoringStatus.Completed;
        record.CompletedAtUtc = now;
        record.UpdatedAtUtc = now;
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "wildlifeMonitoringConfirmed", record.TripId }, ct);
        return Ok(ToDto(record));
    }

    [HttpGet("signature-users/search")]
    public async Task<ActionResult<IReadOnlyList<SignatureUserDto>>> SearchSignatureUsers(
        [FromQuery] string role, [FromQuery(Name = "q")] string query, CancellationToken ct)
    {
        if (role is not (PortalRoles.Supervisor or PortalRoles.HarbourOfficer))
            return ValidationProblem("Role must be Supervisor or HarbourOfficer.");
        var term = query?.Trim() ?? string.Empty;
        if (term.Length < 2) return Ok(Array.Empty<SignatureUserDto>());
        var roleId = await db.Roles.Where(x => x.Name == role).Select(x => (Guid?)x.Id).SingleOrDefaultAsync(ct);
        if (roleId is null) return Ok(Array.Empty<SignatureUserDto>());
        var now = DateTimeOffset.UtcNow;
        var matches = await db.Users.AsNoTracking()
            .Where(x => (x.LockoutEnd == null || x.LockoutEnd <= now) &&
                db.UserRoles.Any(userRole => userRole.UserId == x.Id && userRole.RoleId == roleId) &&
                (x.DisplayName.Contains(term) || (x.UserName != null && x.UserName.Contains(term)) ||
                 (x.Email != null && x.Email.Contains(term))))
            .OrderBy(x => x.DisplayName).Take(10)
            .Select(x => new SignatureUserDto(x.Id, x.DisplayName, x.UserName!, x.Email!, role)).ToListAsync(ct);
        return Ok(matches);
    }

    [HttpPost("records/{id:guid}/signature-requests")]
    public async Task<ActionResult<WildlifeSignatureRequestDto>> RequestSignature(
        Guid id, CreateSignatureRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<WildlifeSignatureType>(request.SignatureType, true, out var signatureType) ||
            !Enum.IsDefined(signatureType))
            return ValidationProblem("Signature type must be Supervisor or HarbourOfficer.");
        var requiredRole = signatureType == WildlifeSignatureType.Supervisor
            ? PortalRoles.Supervisor : PortalRoles.HarbourOfficer;
        Guid? notifyUserId = null;
        Guid? notifyRequestId = null;
        Guid? notifyRecordId = null;
        Guid? notifyTripId = null;

        async Task<ActionResult<WildlifeSignatureRequestDto>> ExecuteRequestAsync()
        {
            // A retry starts from a clean tracking state so a rolled-back first attempt cannot leak changes.
            db.ChangeTracker.Clear();
            var record = await db.WildlifeMonitoringRecords.Include(x => x.SignatureRequests)
                .SingleOrDefaultAsync(x => x.Id == id, ct);
            if (record is null) return NotFound();
            if (!record.UsesSignatureRequestWorkflow)
                return Conflict(new { message = "This completed or legacy record does not use signature requests." });
            if (record.Status is WildlifeMonitoringStatus.Completed or WildlifeMonitoringStatus.Discarded)
                return Conflict(new { message = "Completed or discarded records are read-only." });
            if (record.SignatureRequests.Any(x => x.SignatureType == signatureType &&
                x.Status == WildlifeSignatureRequestStatus.Signed))
                return Conflict(new { message = "The requested signature has already been issued." });

            var roleId = await db.Roles.Where(x => x.Name == requiredRole)
                .Select(x => (Guid?)x.Id).SingleOrDefaultAsync(ct);
            var now = DateTimeOffset.UtcNow;
            var requestedUser = roleId is null ? null : await db.Users.SingleOrDefaultAsync(x =>
                x.Id == request.RequestedUserId && (x.LockoutEnd == null || x.LockoutEnd <= now) &&
                db.UserRoles.Any(userRole => userRole.UserId == x.Id && userRole.RoleId == roleId), ct);
            if (requestedUser is null)
                return ValidationProblem($"Select an active {requiredRole} account.");

            var pending = record.SignatureRequests.SingleOrDefault(x => x.SignatureType == signatureType &&
                x.Status == WildlifeSignatureRequestStatus.Pending);
            if (pending?.RequestedUserId == requestedUser.Id)
            {
                await db.Entry(pending).Reference(x => x.RequestedUser).LoadAsync(ct);
                await db.Entry(pending).Reference(x => x.RequestedByUser).LoadAsync(ct);
                return Ok(ToSignatureRequestDto(pending));
            }

            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            if (pending is not null)
            {
                pending.Status = WildlifeSignatureRequestStatus.Superseded;
                pending.UpdatedAtUtc = now;
                await db.SaveChangesAsync(ct);
            }
            var signatureRequest = new WildlifeSignatureRequest
            {
                Id = Guid.NewGuid(), WildlifeMonitoringRecordId = record.Id, SignatureType = signatureType,
                RequestedUserId = requestedUser.Id, RequestedUser = requestedUser, RequestedByUserId = UserId,
                RequestedAtUtc = now, UpdatedAtUtc = now, Status = WildlifeSignatureRequestStatus.Pending
            };
            db.WildlifeSignatureRequests.Add(signatureRequest);
            record.Status = WildlifeMonitoringStatus.PendingSignatures;
            record.UpdatedAtUtc = now;
            await db.SaveChangesAsync(ct);
            await db.Entry(signatureRequest).Reference(x => x.RequestedByUser).LoadAsync(ct);
            await transaction.CommitAsync(ct);

            notifyUserId = requestedUser.Id;
            notifyRequestId = signatureRequest.Id;
            notifyRecordId = record.Id;
            notifyTripId = record.TripId;
            return Created($"/api/signature-requests/{signatureRequest.Id}", ToSignatureRequestDto(signatureRequest));
        }

        var strategy = db.Database.CreateExecutionStrategy();
        var result = await strategy.ExecuteAsync(ExecuteRequestAsync);
        if (notifyUserId is not null)
        {
            var payload = new { requestId = notifyRequestId, recordId = notifyRecordId, tripId = notifyTripId };
            await hub.Clients.Group($"user:{notifyUserId}").SendAsync("signatureRequestChanged", payload, ct);
            await hub.Clients.Group($"role:{requiredRole}").SendAsync("signatureRequestChanged", payload, ct);
        }
        return result;
    }

    [HttpPost("records/{id:guid}/discard")]
    public async Task<ActionResult<WildlifeRecordDto>> Discard(Guid id, CancellationToken ct)
    {
        var record = await RecordsWithSignatureRequests(tracking: true).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (record is null) return NotFound();
        if (record.Status == WildlifeMonitoringStatus.Completed)
            return Conflict(new { message = "A confirmed monitoring record cannot be discarded." });
        record.Status = WildlifeMonitoringStatus.Discarded;
        record.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "wildlifeMonitoringDiscarded", record.TripId }, ct);
        return Ok(ToDto(record));
    }

    private async Task<WildlifeAttendanceDto?> BuildAttendance(Guid tripId, CancellationToken ct)
    {
        var trip = await db.Trips.AsNoTracking().Where(x => x.Id == tripId).Select(x => new { x.Id, x.BoatId,
            BoatName = x.Boat.Name, x.Boat.RegistrationNumber, OwnerName = x.Boat.Owner.DisplayName,
            x.ScheduledDepartureUtc, x.Route, Status = x.Status.ToString() }).SingleOrDefaultAsync(ct);
        if (trip is null) return null;
        var images = await BoatDisplayImage.GetUrlsAsync(db.BoatDocuments.AsNoTracking()
            .Where(x => x.BoatId == trip.BoatId), ct);
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
            trip.ScheduledDepartureUtc, trip.Route, trip.Status, local, foreign, local.Total + foreign.Total,
            rows.Count == 0 ? DateTimeOffset.UtcNow : rows.Max(x => x.Updated), images.GetValueOrDefault(trip.BoatId));
    }

    private IQueryable<WildlifeMonitoringRecord> RecordsWithSignatureRequests(bool tracking = false)
    {
        var query = db.WildlifeMonitoringRecords
            .Include(x => x.Trip).ThenInclude(x => x.Boat)
            .Include(x => x.SignatureRequests).ThenInclude(x => x.RequestedUser)
            .Include(x => x.SignatureRequests).ThenInclude(x => x.RequestedByUser);
        return tracking ? query : query.AsNoTracking();
    }

    private static bool Eq(string value, string expected) => string.Equals(value, expected, StringComparison.OrdinalIgnoreCase);
    internal static bool ValidSignature(string? value) => value is not null &&
        value.StartsWith("data:image/png;base64,", StringComparison.Ordinal) && value.Length <= 500000;
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
    internal static WildlifeSignatureRequestDto ToSignatureRequestDto(WildlifeSignatureRequest request) => new(
        request.Id, request.WildlifeMonitoringRecordId, request.SignatureType.ToString(), request.Status.ToString(),
        request.RequestedUserId, request.SignedByName ?? request.RequestedUser.DisplayName, request.RequestedUser.UserName ?? string.Empty,
        request.RequestedUser.Email ?? string.Empty, request.RequestedByUser.DisplayName, request.RequestedAtUtc,
        request.SignedAtUtc, request.DeclinedAtUtc, request.DeclineReason, request.SignatureData);
    private static WildlifeSignatureRequestDto? CurrentRequest(WildlifeMonitoringRecord record,
        WildlifeSignatureType type) => record.SignatureRequests.Where(x => x.SignatureType == type &&
            x.Status != WildlifeSignatureRequestStatus.Superseded &&
            x.Status != WildlifeSignatureRequestStatus.Cancelled)
        .OrderByDescending(x => x.RequestedAtUtc).Select(ToSignatureRequestDto).FirstOrDefault();
    private static WildlifeRecordDto ToDto(WildlifeMonitoringRecord x) => new(x.Id, x.TripId, x.Trip.Boat.Name,
        x.Trip.Boat.RegistrationNumber, x.Trip.ScheduledDepartureUtc, x.TicketNumber,
        x.TidNumber, x.MonitoringOfficer, x.Supervisor, x.Status.ToString(), new CountDto(x.LocalAdultSnapshot,
        x.LocalChildSnapshot, x.LocalSmallSnapshot), new CountDto(x.ForeignAdultSnapshot, x.ForeignChildSnapshot,
        x.ForeignSmallSnapshot), x.LocalAdultSnapshot + x.LocalChildSnapshot + x.LocalSmallSnapshot +
        x.ForeignAdultSnapshot + x.ForeignChildSnapshot + x.ForeignSmallSnapshot, x.HarbourOfficerName,
        x.SignedAtUtc, x.CreatedAtUtc, x.CompletedAtUtc, x.MonitoringOfficerSignature,
        x.SupervisorSignature, x.HarbourOfficerSignature, x.UsesSignatureRequestWorkflow,
        x.MonitoringOfficerSignedAtUtc, CurrentRequest(x, WildlifeSignatureType.Supervisor),
        CurrentRequest(x, WildlifeSignatureType.HarbourOfficer));
}

public sealed record WildlifeTripDto(Guid Id, string BoatName, string RegistrationNumber, string OwnerName,
    DateTimeOffset ScheduledDepartureUtc, string Route, string Status, int RegisteredPassengers,
    string MonitoringStatus, Guid BoatId, string? ImageUrl);
public sealed record CountDto(int Adult, int Child, int Small) { public int Total => Adult + Child + Small; }
public sealed record WildlifeAttendanceDto(Guid TripId, string BoatName, string RegistrationNumber, string OwnerName,
    DateTimeOffset ScheduledDepartureUtc, string Route, string TripStatus, CountDto Local, CountDto Foreign,
    int TotalPresent, DateTimeOffset LastUpdatedUtc, string? ImageUrl);
public sealed record WildlifeRecordDto(Guid Id, Guid TripId, string BoatName, string RegistrationNumber,
    DateTimeOffset ScheduledDepartureUtc, string TicketNumber, string TidNumber,
    string MonitoringOfficer, string Supervisor, string Status, CountDto Local, CountDto Foreign, int TotalPresent,
    string? HarbourOfficerName, DateTimeOffset? SignedAtUtc, DateTimeOffset CreatedAtUtc, DateTimeOffset? CompletedAtUtc,
    string? MonitoringOfficerSignature, string? SupervisorSignature, string? HarbourOfficerSignature,
    bool UsesSignatureRequestWorkflow, DateTimeOffset? MonitoringOfficerSignedAtUtc,
    WildlifeSignatureRequestDto? SupervisorRequest, WildlifeSignatureRequestDto? HarbourOfficerRequest);
public sealed record CreateWildlifeRecordRequest(Guid TripId,
    [param: Required, MaxLength(80)] string TicketNumber, [param: Required, MaxLength(80)] string TidNumber,
    [param: Required, MaxLength(160)] string MonitoringOfficer);
public sealed record UpdateWildlifeRecordRequest([param: Required, MaxLength(80)] string TicketNumber,
    [param: Required, MaxLength(80)] string TidNumber, [param: Required, MaxLength(160)] string MonitoringOfficer);
public sealed record SignWildlifeRecordRequest([param: Required] string MonitoringOfficerSignature);
public sealed record SignatureUserDto(Guid Id, string FullName, string Username, string Email, string Role);
public sealed record CreateSignatureRequest(Guid RequestedUserId,
    [param: Required, MaxLength(32)] string SignatureType);
public sealed record WildlifeSignatureRequestDto(Guid Id, Guid WildlifeMonitoringRecordId,
    string SignatureType, string Status, Guid RequestedUserId, string RequestedUserFullName,
    string RequestedUsername, string RequestedUserEmail, string RequestedByName,
    DateTimeOffset RequestedAtUtc, DateTimeOffset? SignedAtUtc, DateTimeOffset? DeclinedAtUtc,
    string? DeclineReason, string? SignatureData);

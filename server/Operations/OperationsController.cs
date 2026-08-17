using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.WebUtilities;
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
    private const int MaxInlineImageUrlLength = 1_000_000;

    [HttpGet("directory")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.Ops},{PortalRoles.ShoreCrew}")]
    public async Task<ActionResult<OperationsDirectoryDto>> Directory(CancellationToken ct)
    {
        var owners = await db.Users.AsNoTracking()
            .Where(user => db.UserRoles.Any(userRole => userRole.UserId == user.Id &&
                db.Roles.Any(role => role.Id == userRole.RoleId && role.Name == PortalRoles.BoatOwner)))
            .OrderBy(user => user.DisplayName)
            .Select(user => new DirectoryOwnerDto(user.Id, user.DisplayName, user.Email!, user.PhoneNumber,
                user.NicNumber, user.Bio))
            .ToListAsync(ct);
        var crew = await db.OwnerCrewMemberships.AsNoTracking()
            .OrderBy(x => x.CrewUser.DisplayName)
            .Select(x => new DirectoryCrewDto(x.CrewUserId, x.CrewUser.DisplayName, x.CrewUser.Email!,
                x.CrewUser.PhoneNumber, x.CrewUser.CrewType ?? "Crew Member",
                db.CrewAssignments.Where(a => a.CrewUserId == x.CrewUserId && a.Boat.OwnerId == x.OwnerId && a.IsActive)
                    .Select(a => (Guid?)a.BoatId).FirstOrDefault(), x.OwnerId,
                x.CrewUser.NicNumber, x.CrewUser.IsCrewCertified))
            .ToListAsync(ct);
        return Ok(new OperationsDirectoryDto(owners, crew));
    }

    [HttpGet("owner/crew")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult<IReadOnlyList<OwnerCrewDto>>> OwnerCrew(CancellationToken ct)
    {
        return Ok(await db.OwnerCrewMemberships.AsNoTracking().Where(x => x.OwnerId == UserId)
            .OrderBy(x => x.CrewUser.DisplayName)
            .Select(x => new OwnerCrewDto(x.Id, x.CrewUserId, x.CrewUser.DisplayName,
                x.CrewUser.Email!, x.CrewUser.PhoneNumber, x.CrewUser.CrewType ?? "Crew Member",
                x.CrewUser.IsCrewCertified)).ToListAsync(ct));
    }

    [HttpGet("owner/crew/search")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult<IReadOnlyList<CrewSuggestionDto>>> SearchCertifiedCrew(
        [FromQuery] string query, CancellationToken ct)
    {
        var term = query.Trim(); if (term.Length < 2) return Ok(Array.Empty<CrewSuggestionDto>());
        var normalized = term.ToUpperInvariant();
        return Ok(await db.Users.AsNoTracking().Where(user => user.IsCrewCertified &&
                user.NormalizedEmail != null && user.NormalizedEmail.Contains(normalized) &&
                db.UserRoles.Any(ur => ur.UserId == user.Id && db.Roles.Any(role =>
                    role.Id == ur.RoleId && role.Name == PortalRoles.BoatCrew)) &&
                !db.OwnerCrewMemberships.Any(membership => membership.OwnerId == UserId && membership.CrewUserId == user.Id))
            .OrderBy(user => user.Email).Take(8)
            .Select(user => new CrewSuggestionDto(user.Id, user.DisplayName, user.Email!,
                user.CrewType ?? "Crew Member")).ToListAsync(ct));
    }

    [HttpPost("owner/crew")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult<OwnerCrewDto>> AddOwnerCrew(AddOwnerCrewRequest request, CancellationToken ct)
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var crew = await db.Users.SingleOrDefaultAsync(x => x.NormalizedEmail == normalizedEmail, ct);
        if (crew is null || !await db.UserRoles.AnyAsync(ur => ur.UserId == crew.Id &&
            db.Roles.Any(role => role.Id == ur.RoleId && role.Name == PortalRoles.BoatCrew), ct))
            return ValidationProblem("No Boat Crew account was found for that email address.");
        if (!crew.IsCrewCertified) return ValidationProblem("This crew member has not been certified yet.");
        var membership = await db.OwnerCrewMemberships.SingleOrDefaultAsync(x =>
            x.OwnerId == UserId && x.CrewUserId == crew.Id, ct);
        if (membership is not null) return Conflict(new { message = "This crew member is already in your crew." });
        membership = new OwnerCrewMembership { Id = Guid.NewGuid(), OwnerId = UserId,
            CrewUserId = crew.Id, AddedAtUtc = DateTimeOffset.UtcNow };
        db.OwnerCrewMemberships.Add(membership);
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "crew", id = membership.Id }, ct);
        return Ok(new OwnerCrewDto(membership.Id, crew.Id, crew.DisplayName, crew.Email!, crew.PhoneNumber,
            crew.CrewType ?? "Crew Member", crew.IsCrewCertified));
    }

    [HttpDelete("owner/crew/{assignmentId:guid}")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<IActionResult> RemoveOwnerCrew(Guid assignmentId, CancellationToken ct)
    {
        var membership = await db.OwnerCrewMemberships.SingleOrDefaultAsync(x =>
            x.Id == assignmentId && x.OwnerId == UserId, ct);
        if (membership is null) return NotFound();
        db.OwnerCrewMemberships.Remove(membership); await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "crew", id = membership.Id }, ct);
        return NoContent();
    }

    [HttpGet("boats")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.Ops},{PortalRoles.ShoreCrew},{PortalRoles.BoatOwner},{PortalRoles.BoatCrew}")]
    public async Task<ActionResult<IReadOnlyList<BoatDto>>> Boats(CancellationToken ct)
    {
        var query = ScopeBoats(db.Boats.AsNoTracking()).OrderBy(x => x.Name);
        var boats = await query.Select(x => new
        {
            x.Id, x.OwnerId, OwnerName = x.Owner.DisplayName, x.Name, x.RegistrationNumber,
            x.RegistrationDate, x.HullNumber, x.LengthMeters, x.WidthMeters, x.MaximumSpeedKnots,
            x.MaximumCapacity, x.LifeJacketCount, x.GpsDeviceId, x.Approval, x.WildlifeApproval,
            ImageUrl = x.ImageUrl != null && x.ImageUrl.Length <= MaxInlineImageUrlLength ? x.ImageUrl : null
        }).ToListAsync(ct);
        var boatIds = boats.Select(boat => boat.Id).ToArray();
        var documents = await db.BoatDocuments.AsNoTracking().Where(document => boatIds.Contains(document.BoatId))
            .OrderBy(document => document.Name)
            .Select(document => new
            {
                document.BoatId,
                Document = new BoatDocumentDto(document.Id, document.Name, document.FileName,
                    document.ContentType, document.UploadedAtUtc, document.ExpirationDate)
            }).ToListAsync(ct);
        var documentsByBoat = documents.ToLookup(document => document.BoatId, document => document.Document);

        return Ok(boats.Select(boat => new BoatDto(boat.Id, boat.OwnerId, boat.OwnerName, boat.Name,
            boat.RegistrationNumber, boat.RegistrationDate, boat.HullNumber, boat.LengthMeters, boat.WidthMeters,
            boat.MaximumSpeedKnots, boat.MaximumCapacity, boat.LifeJacketCount, boat.GpsDeviceId,
            boat.Approval.ToString(), boat.WildlifeApproval.ToString(), boat.ImageUrl,
            documentsByBoat[boat.Id].ToArray())).ToList());
    }

    [HttpGet("vessel-map")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.Ops},{PortalRoles.ShoreCrew},{PortalRoles.BoatOwner},{PortalRoles.BoatCrew}")]
    public async Task<ActionResult<IReadOnlyList<VesselMapDto>>> VesselMap(CancellationToken ct)
    {
        var boats = await ScopeBoats(db.Boats.AsNoTracking())
            .Include(x => x.CrewAssignments)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);
        var boatIds = boats.Select(x => x.Id).ToArray();
        var trips = await ScopeTrips(db.Trips.AsNoTracking()).Where(x => boatIds.Contains(x.BoatId))
            .OrderByDescending(x => x.ActualDepartureUtc ?? x.ScheduledDepartureUtc).ToListAsync(ct);
        var deviceIds = boats.Where(x => x.GpsDeviceId != null).Select(x => x.GpsDeviceId!).ToArray();
        var telemetry = await db.GpsTelemetry.AsNoTracking().Where(x => deviceIds.Contains(x.DeviceId))
            .GroupBy(x => x.DeviceId).Select(group => group.OrderByDescending(x => x.RecordedAtUtc).First())
            .ToListAsync(ct);

        return Ok(boats.Select(boat =>
        {
            var trip = trips.FirstOrDefault(x => x.BoatId == boat.Id && x.Status == TripStatus.Ongoing)
                ?? trips.FirstOrDefault(x => x.BoatId == boat.Id);
            var gps = telemetry.FirstOrDefault(x => x.DeviceId == boat.GpsDeviceId);
            var crew = boat.CrewAssignments.Where(x => x.IsActive).ToList();
            return new VesselMapDto(boat.Id, boat.Name, boat.RegistrationNumber, boat.ImageUrl,
                boat.Approval.ToString(), boat.WildlifeApproval.ToString(),
                trip?.ShoreApproval.ToString() ?? ApprovalStatus.Pending.ToString(),
                trip?.WildlifeShoreApproval.ToString() ?? ApprovalStatus.Pending.ToString(),
                boat.Approval == ApprovalStatus.Approved && boat.WildlifeApproval == ApprovalStatus.Approved &&
                    trip?.ShoreApproval == ApprovalStatus.Approved && trip.WildlifeShoreApproval == ApprovalStatus.Approved,
                gps?.Latitude, gps?.Longitude, gps?.RecordedAtUtc, trip?.ActualDepartureUtc,
                trip?.ActualArrivalUtc, boat.LengthMeters, boat.WidthMeters, gps?.SpeedKnots,
                boat.MaximumSpeedKnots, boat.MaximumCapacity, boat.LifeJacketCount,
                trip?.PassengerCount ?? 0, trip?.ChildrenCount ?? 0, trip?.SpecialNeedsCount ?? 0,
                crew.Count(x => x.Position.Contains("Life Saver")), crew.Count(x => x.Position.Contains("Diver")),
                crew.Count(x => x.Position.Contains("Coxswain")));
        }));
    }

    [HttpGet("trips")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.Ops},{PortalRoles.ShoreCrew},{PortalRoles.BoatOwner},{PortalRoles.BoatCrew}")]
    public async Task<ActionResult<IReadOnlyList<TripDto>>> Trips(CancellationToken ct)
    {
        return Ok(await ScopeTrips(db.Trips.AsNoTracking())
            .OrderByDescending(x => x.ScheduledDepartureUtc)
            .Select(x => new TripDto(x.Id, x.BoatId, x.Boat.Name, x.Boat.RegistrationNumber,
                x.Boat.Owner.DisplayName, x.ScheduledDepartureUtc, x.ActualDepartureUtc,
                x.ActualArrivalUtc, x.Route, x.PassengerCount, x.Status.ToString(),
                x.ShoreApproval.ToString(), x.WildlifeShoreApproval.ToString(), x.ShoreNotes, x.UpdatedAtUtc, x.InvitationCode,
                x.CrewAssignments.OrderBy(a => a.CrewUser.DisplayName).Select(a => new TripCrewDto(
                    a.CrewUserId, a.CrewUser.DisplayName, a.CrewUser.Email!,
                    a.CrewUser.CrewType ?? "Crew Member", a.CrewUser.NicNumber,
                    a.CrewUser.IsCrewCertified)).ToList(),
                db.SosEvents.Any(s => s.TripId == x.Id && s.ResolvedAtUtc == null))).ToListAsync(ct));
    }

    [HttpGet("sos")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.Ops},{PortalRoles.ShoreCrew},{PortalRoles.BoatOwner},{PortalRoles.BoatCrew}")]
    public async Task<ActionResult<IReadOnlyList<SosAlertDto>>> SosAlerts(CancellationToken ct)
    {
        var allowedTrips = ScopeTrips(db.Trips.AsNoTracking()).Select(x => x.Id);
        var alerts = await db.SosEvents.AsNoTracking().Where(x => x.ResolvedAtUtc == null && allowedTrips.Contains(x.TripId))
            .OrderByDescending(x => x.RaisedAtUtc)
            .Select(x => new { x.Id, x.TripId, x.Trip.BoatId, VesselName = x.Trip.Boat.Name,
                x.Trip.Boat.RegistrationNumber, PassengersOnboard = x.Trip.PassengerCount,
                NatureOfEmergency = x.Message, x.RaisedAtUtc }).ToListAsync(ct);
        var boatIds = alerts.Select(x => x.BoatId).Distinct().ToArray();
        var deviceIds = await db.Boats.AsNoTracking().Where(x => boatIds.Contains(x.Id) && x.GpsDeviceId != null)
            .Select(x => new { x.Id, x.GpsDeviceId }).ToListAsync(ct);
        var telemetry = await db.GpsTelemetry.AsNoTracking().Where(x => deviceIds.Select(d => d.GpsDeviceId!).Contains(x.DeviceId))
            .OrderByDescending(x => x.RecordedAtUtc).ToListAsync(ct);
        return Ok(alerts.Select(x => {
            var device = deviceIds.FirstOrDefault(d => d.Id == x.BoatId)?.GpsDeviceId;
            var gps = telemetry.FirstOrDefault(t => t.DeviceId == device);
            return new SosAlertDto(x.Id, x.TripId, x.VesselName, x.RegistrationNumber,
                gps is null ? "Location unavailable" : $"{gps.Latitude:F6}, {gps.Longitude:F6}",
                x.PassengersOnboard, x.NatureOfEmergency, x.RaisedAtUtc);
        }).ToList());
    }

    [HttpPost("trips/{id:guid}/sos")]
    [Authorize(Policy = PortalPolicies.BoatCrew)]
    public async Task<ActionResult> RaiseCrewSos(Guid id, CancellationToken ct)
    {
        var trip = await db.Trips.Include(x => x.CrewAssignments).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (trip is null || !trip.CrewAssignments.Any(x => x.CrewUserId == UserId)) return NotFound();
        if (trip.Status != TripStatus.Ongoing)
            return Conflict(new { message = "An SOS can only be raised while the trip is ongoing." });
        var existing = await db.SosEvents.SingleOrDefaultAsync(x => x.TripId == id && x.RaisedByUserId == UserId && x.ResolvedAtUtc == null, ct);
        if (existing is not null) return Ok(new { id = existing.Id, raisedAtUtc = existing.RaisedAtUtc });
        var sos = new SosEvent { Id = Guid.NewGuid(), TripId = id, RaisedByUserId = UserId,
            Message = "Emergency assistance requested by assigned boat crew", RaisedAtUtc = DateTimeOffset.UtcNow };
        db.SosEvents.Add(sos); trip.UpdatedAtUtc = DateTimeOffset.UtcNow;
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            db.Entry(sos).State = EntityState.Detached;
            existing = await db.SosEvents.AsNoTracking().SingleOrDefaultAsync(x =>
                x.TripId == id && x.RaisedByUserId == UserId && x.ResolvedAtUtc == null, ct);
            if (existing is not null) return Ok(new { id = existing.Id, raisedAtUtc = existing.RaisedAtUtc });
            throw;
        }
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "sos", id = sos.Id, tripId = id }, ct);
        return Created($"/api/operations/sos/{sos.Id}", new { id = sos.Id, raisedAtUtc = sos.RaisedAtUtc });
    }

    [HttpGet("trips/{id:guid}/sos-actions")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.ShoreWildlife},{PortalRoles.Ops},{PortalRoles.ShoreCrew},{PortalRoles.BoatOwner},{PortalRoles.BoatCrew}")]
    public async Task<ActionResult<IReadOnlyList<SosActionDto>>> SosActions(Guid id, CancellationToken ct)
    {
        if (!await ScopeTrips(db.Trips.AsNoTracking()).AnyAsync(x => x.Id == id, ct))
            return NotFound();

        return Ok(await db.SosActions.AsNoTracking().Where(x => x.SosEvent.TripId == id)
            .OrderByDescending(x => x.TakenAtUtc)
            .Select(x => new SosActionDto(x.Id, x.SosEventId, x.TakenByUser.DisplayName,
                x.Details, x.TakenAtUtc)).ToListAsync(ct));
    }

    [HttpPost("trips/{id:guid}/sos-actions")]
    [Authorize(Roles = PortalRoles.Ops)]
    public async Task<ActionResult<SosActionDto>> AddSosAction(Guid id, SosActionRequest request, CancellationToken ct)
    {
        var details = request.Details?.Trim() ?? string.Empty;
        if (details.Length is < 1 or > 1000)
            return ValidationProblem("Action details must contain between 1 and 1000 characters.");

        var sos = await db.SosEvents.Where(x => x.TripId == id && x.ResolvedAtUtc == null)
            .OrderByDescending(x => x.RaisedAtUtc).FirstOrDefaultAsync(ct);
        if (sos is null) return Conflict(new { message = "This trip has no active SOS alert." });

        var action = new SosAction { Id = Guid.NewGuid(), SosEventId = sos.Id,
            TakenByUserId = UserId, Details = details, TakenAtUtc = DateTimeOffset.UtcNow };
        var takenBy = await db.Users.Where(x => x.Id == UserId).Select(x => x.DisplayName).SingleAsync(ct);
        db.SosActions.Add(action);
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "sosAction", id = action.Id, tripId = id }, ct);
        return Created($"/api/operations/trips/{id}/sos-actions/{action.Id}",
            new SosActionDto(action.Id, action.SosEventId, takenBy, action.Details, action.TakenAtUtc));
    }

    [HttpGet("trips/{id:guid}/passengers")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.Ops},{PortalRoles.BoatOwner},{PortalRoles.ShoreCrew},{PortalRoles.BoatCrew}")]
    public async Task<ActionResult<IReadOnlyList<TripPassengerDto>>> TripPassengers(Guid id, CancellationToken ct)
    {
        var tripExists = await ScopeTrips(db.Trips.AsNoTracking()).AnyAsync(x => x.Id == id, ct);
        if (!tripExists) return NotFound();

        return Ok(await db.TripPassengers.AsNoTracking().Where(x => x.TripId == id)
            .OrderBy(x => x.Passenger.Name)
            .Select(x => new TripPassengerDto(x.PassengerId, x.Passenger.Name,
                x.Passenger.IdentificationNumber, x.Passenger.PhoneNumber, x.Passenger.AgeCategory,
                x.Passenger.PassengerType, x.Passenger.Gender, x.RegisteredAtUtc)).ToListAsync(ct));
    }

    [HttpPost("boats")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult> CreateBoat(CreateBoatRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.RegistrationNumber) ||
            string.IsNullOrWhiteSpace(request.HullNumber))
            return ValidationProblem("Boat name, registration number, and hull number are required.");
        if (request.RegistrationDate == default ||
            request.RegistrationDate > DateOnly.FromDateTime(DateTime.UtcNow))
            return ValidationProblem("Registration date must be a valid date that is not in the future.");

        var registrationNumber = request.RegistrationNumber.Trim();
        if (await db.Boats.AsNoTracking().AnyAsync(x => x.RegistrationNumber == registrationNumber, ct))
            return Conflict(new { message = "A boat with this registration number already exists." });

        var gpsDeviceId = string.IsNullOrWhiteSpace(request.GpsDeviceId) ? null : request.GpsDeviceId.Trim();
        if (gpsDeviceId is not null &&
            await db.Boats.AsNoTracking().AnyAsync(x => x.GpsDeviceId == gpsDeviceId, ct))
            return Conflict(new { message = "This GPS device ID is already assigned to another boat." });

        var boat = new Boat { Id = Guid.NewGuid(), OwnerId = UserId, Name = request.Name.Trim(),
            RegistrationNumber = registrationNumber, RegistrationDate = request.RegistrationDate,
            HullNumber = request.HullNumber.Trim(), LengthMeters = request.LengthMeters,
            WidthMeters = request.WidthMeters, MaximumCapacity = request.MaximumCapacity,
            MaximumSpeedKnots = request.MaximumSpeedKnots,
            LifeJacketCount = request.LifeJacketCount, GpsDeviceId = gpsDeviceId,
            Approval = ApprovalStatus.Pending, WildlifeApproval = ApprovalStatus.Pending, ImageUrl = request.ImageUrl };
        db.Boats.Add(boat);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            db.Entry(boat).State = EntityState.Detached;
            if (await db.Boats.AsNoTracking().AnyAsync(x => x.RegistrationNumber == registrationNumber, ct))
                return Conflict(new { message = "A boat with this registration number already exists." });
            if (gpsDeviceId is not null &&
                await db.Boats.AsNoTracking().AnyAsync(x => x.GpsDeviceId == gpsDeviceId, ct))
                return Conflict(new { message = "This GPS device ID is already assigned to another boat." });
            throw;
        }
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "boat", id = boat.Id }, ct);
        return Created($"api/operations/boats/{boat.Id}", new { boat.Id });
    }

    [HttpDelete("boats/{id:guid}/registration")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<IActionResult> CancelBoatRegistration(Guid id, CancellationToken ct)
    {
        var boat = await db.Boats.Include(x => x.Documents)
            .SingleOrDefaultAsync(x => x.Id == id && x.OwnerId == UserId, ct);
        if (boat is null) return NoContent();

        if (boat.Approval != ApprovalStatus.Pending || boat.WildlifeApproval != ApprovalStatus.Pending ||
            await db.Trips.AnyAsync(x => x.BoatId == id, ct) ||
            await db.CrewAssignments.AnyAsync(x => x.BoatId == id, ct))
            return Conflict(new { message = "Only an unused pending boat registration can be cancelled." });

        db.BoatDocuments.RemoveRange(boat.Documents);
        db.Boats.Remove(boat);
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "boat", id, deleted = true }, ct);
        return NoContent();
    }

    [HttpPatch("boats/{id:guid}/approval")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife}")]
    public async Task<ActionResult> UpdateBoatApproval(Guid id, ApprovalRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<ApprovalStatus>(request.Approval, true, out var approval) || approval == ApprovalStatus.Pending)
            return ValidationProblem("Approval must be Approved or Rejected.");
        var boat = await db.Boats.FindAsync([id], ct); if (boat is null) return NotFound();
        boat.Approval = approval;
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "boat", id }, ct);
        return NoContent();
    }

    [HttpDelete("boats/{id:guid}")]
    [Authorize(Roles = PortalRoles.Admin)]
    public async Task<IActionResult> DeleteBoat(Guid id, CancellationToken ct)
    {
        var boat = await db.Boats.Include(x => x.CrewAssignments)
            .SingleOrDefaultAsync(x => x.Id == id, ct);
        if (boat is null) return NotFound();

        if (await db.Trips.AnyAsync(x => x.BoatId == id &&
                (x.Status == TripStatus.Scheduled || x.Status == TripStatus.Boarding ||
                 x.Status == TripStatus.Ongoing), ct))
            return Conflict(new { message = "Active trips must be completed or cancelled before deleting this boat." });

        boat.IsDeleted = true;
        foreach (var assignment in boat.CrewAssignments) assignment.IsActive = false;
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "boat", id, deleted = true }, ct);
        return NoContent();
    }

    [HttpPatch("crew/{id:guid}/approval")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife}")]
    public async Task<ActionResult> UpdateCrewApproval(Guid id, ApprovalRequest request, CancellationToken ct)
    {
        if (!string.Equals(request.Approval, "Approved", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(request.Approval, "Rejected", StringComparison.OrdinalIgnoreCase))
            return ValidationProblem("Approval must be Approved or Rejected.");
        var crew = await db.Users.FindAsync([id], ct); if (crew is null) return NotFound();
        var isBoatCrew = await db.UserRoles.AnyAsync(userRole => userRole.UserId == id &&
            db.Roles.Any(role => role.Id == userRole.RoleId && role.Name == PortalRoles.BoatCrew), ct);
        if (!isBoatCrew) return NotFound();
        crew.IsCrewCertified = string.Equals(request.Approval, "Approved", StringComparison.OrdinalIgnoreCase);
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "crew", id }, ct);
        return NoContent();
    }

    [HttpPost("boats/{boatId:guid}/documents")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<BoatDocumentDto>> UploadBoatDocument(Guid boatId, [FromForm] string name,
        [FromForm] IFormFile file, [FromForm] DateOnly? expirationDate, CancellationToken ct)
    {
        if (!await db.Boats.AnyAsync(x => x.Id == boatId && x.OwnerId == UserId, ct)) return Forbid();
        if (string.IsNullOrWhiteSpace(name) || name.Length > 160) return ValidationProblem("Certificate name is required.");
        if (string.Equals(name.Trim(), "Boat Insurance", StringComparison.OrdinalIgnoreCase) && expirationDate is null)
            return ValidationProblem("The boat insurance expiration date is required.");
        if (expirationDate < DateOnly.FromDateTime(DateTime.UtcNow))
            return ValidationProblem("The document expiration date cannot be in the past.");
        if (file.Length is 0 or > 10 * 1024 * 1024) return ValidationProblem("Certificate must be between 1 byte and 10 MB.");
        var types = new[] { "application/pdf", "image/jpeg", "image/png" };
        if (!types.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase))
            return ValidationProblem("Certificate must be a PDF, JPEG, or PNG file.");
        await using var stream = new MemoryStream(); await file.CopyToAsync(stream, ct);
        var document = new BoatDocument { Id = Guid.NewGuid(), BoatId = boatId, Name = name.Trim(),
            FileName = Path.GetFileName(file.FileName), ContentType = file.ContentType,
            Content = stream.ToArray(), UploadedAtUtc = DateTimeOffset.UtcNow, ExpirationDate = expirationDate };
        db.BoatDocuments.Add(document); await db.SaveChangesAsync(ct);
        return Created($"api/operations/boats/{boatId}/documents/{document.Id}",
            new BoatDocumentDto(document.Id, document.Name, document.FileName, document.ContentType,
                document.UploadedAtUtc, document.ExpirationDate));
    }

    [HttpGet("boats/{boatId:guid}/documents/{documentId:guid}")]
    public async Task<IActionResult> DownloadBoatDocument(Guid boatId, Guid documentId, CancellationToken ct)
    {
        var allowedBoats = ScopeBoats(db.Boats).Select(x => x.Id);
        var document = await db.BoatDocuments.AsNoTracking().SingleOrDefaultAsync(x =>
            x.Id == documentId && x.BoatId == boatId && allowedBoats.Contains(x.BoatId), ct);
        return document?.Content is { Length: > 0 }
            ? File(document.Content, document.ContentType, document.FileName)
            : NotFound();
    }

    [HttpPost("trips")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult> CreateTrip(CreateTripRequest request, CancellationToken ct)
    {
        if (request.ScheduledDepartureUtc <= DateTimeOffset.UtcNow)
            return ValidationProblem("Scheduled departure must be in the future.");
        var selectedCrewIds = request.CrewUserIds?.Distinct().ToArray() ?? [];
        var autoAssignCrew = selectedCrewIds.Length == 0;
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (!await db.Boats.AnyAsync(x => x.Id == request.BoatId && x.OwnerId == UserId, ct)) return Forbid();

            var crewIds = selectedCrewIds;
            if (autoAssignCrew)
            {
                crewIds = await db.OwnerCrewMemberships.Where(x => x.OwnerId == UserId &&
                        x.CrewUser.IsCrewCertified && !db.TripCrewAssignments.Any(assignment =>
                            assignment.CrewUserId == x.CrewUserId &&
                            assignment.Trip.ScheduledDepartureUtc == request.ScheduledDepartureUtc &&
                            (assignment.Trip.Status == TripStatus.Scheduled ||
                             assignment.Trip.Status == TripStatus.Boarding ||
                             assignment.Trip.Status == TripStatus.Ongoing)))
                    .OrderBy(x => x.CrewUser.DisplayName).Select(x => x.CrewUserId).ToArrayAsync(ct);
                if (crewIds.Length == 0)
                    return ValidationProblem("No certified crew members are available at the selected date and time.");
            }
            else
            {
                var validCrewCount = await db.OwnerCrewMemberships.CountAsync(x => x.OwnerId == UserId &&
                    crewIds.Contains(x.CrewUserId) && x.CrewUser.IsCrewCertified, ct);
                if (validCrewCount != crewIds.Length)
                    return ValidationProblem("Every selected crew member must be certified and belong to your crew.");
            }

            var trip = new Trip { Id = Guid.NewGuid(), BoatId = request.BoatId,
                ScheduledDepartureUtc = request.ScheduledDepartureUtc, Route = request.Route.Trim(),
                PassengerCount = request.PassengerCount, Status = TripStatus.Scheduled,
                ChildrenCount = request.ChildrenCount, SpecialNeedsCount = request.SpecialNeedsCount,
                ShoreApproval = ApprovalStatus.Pending, WildlifeShoreApproval = ApprovalStatus.Pending,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
                InvitationCode = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32)) };
            db.Trips.Add(trip);
            db.TripCrewAssignments.AddRange(crewIds.Select(crewId => new TripCrewAssignment {
                Id = Guid.NewGuid(), TripId = trip.Id, CrewUserId = crewId }));
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            await hub.Clients.All.SendAsync("operationsChanged", new { entity = "trip", id = trip.Id }, ct);
            return Created($"api/operations/trips/{trip.Id}", new {
                trip.Id, crewUserIds = crewIds, crewAutoAssigned = autoAssignCrew });
        });
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
        if (!Enum.TryParse<TripStatus>(request.Status, true, out var status) || !Enum.IsDefined(status))
            return ValidationProblem("Invalid status.");
        var trip = await db.Trips.Include(x => x.Boat).Include(x => x.CrewAssignments)
            .SingleOrDefaultAsync(x => x.Id == id, ct);
        if (trip is null) return NotFound();
        var canUpdate = User.IsInRole(PortalRoles.Ops) ||
            (User.IsInRole(PortalRoles.BoatOwner) && trip.Boat.OwnerId == UserId) ||
            (User.IsInRole(PortalRoles.BoatCrew) && trip.CrewAssignments.Any(x => x.CrewUserId == UserId));
        if (!canUpdate) return Forbid();
        if (!CanTransitionTripStatus(trip.Status, status))
            return Conflict(new { message = $"Trip status cannot change from {trip.Status} to {status}." });
        if (trip.Status == status) return NoContent();
        if (status == TripStatus.Ongoing)
        {
            if (trip.PassengerVerificationFinalizedAtUtc is null)
                return Conflict(new
                {
                    message = "Passenger verification must be finalized by shore crew before starting the trip."
                });

            var incompleteApprovals = new List<string>();
            if (trip.Boat.Approval != ApprovalStatus.Approved) incompleteApprovals.Add("boat certification");
            if (trip.Boat.WildlifeApproval != ApprovalStatus.Approved)
                incompleteApprovals.Add("wildlife boat approval");
            if (trip.ShoreApproval != ApprovalStatus.Approved) incompleteApprovals.Add("SLCG shore approval");
            if (trip.WildlifeShoreApproval != ApprovalStatus.Approved)
                incompleteApprovals.Add("wildlife shore approval");
            if (incompleteApprovals.Count > 0)
                return Conflict(new
                {
                    message = $"The trip cannot start until these approvals are complete: {string.Join(", ", incompleteApprovals)}."
                });
        }

        trip.Status = status; trip.UpdatedAtUtc = DateTimeOffset.UtcNow;
        if (status == TripStatus.Ongoing) trip.ActualDepartureUtc ??= DateTimeOffset.UtcNow;
        if (status == TripStatus.Completed) trip.ActualArrivalUtc ??= DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct); await hub.Clients.All.SendAsync("operationsChanged", new { entity = "trip", id }, ct);
        return NoContent();
    }

    private static bool CanTransitionTripStatus(TripStatus current, TripStatus next) =>
        current == next || current switch
        {
            TripStatus.Scheduled => next is TripStatus.Boarding or TripStatus.Ongoing or TripStatus.Cancelled,
            TripStatus.Boarding => next is TripStatus.Ongoing or TripStatus.Cancelled,
            TripStatus.Ongoing => next is TripStatus.Completed or TripStatus.Cancelled,
            _ => false,
        };

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
    private IQueryable<Boat> ScopeBoats(IQueryable<Boat> query)
    {
        if (User.IsInRole(PortalRoles.BoatOwner)) return query.Where(x => x.OwnerId == UserId);
        if (User.IsInRole(PortalRoles.BoatCrew)) return query.Where(x =>
            x.Trips.Any(trip => trip.CrewAssignments.Any(assignment => assignment.CrewUserId == UserId)));
        return query;
    }

    private IQueryable<Trip> ScopeTrips(IQueryable<Trip> query)
    {
        if (User.IsInRole(PortalRoles.BoatOwner)) return query.Where(x => x.Boat.OwnerId == UserId);
        if (User.IsInRole(PortalRoles.BoatCrew)) return query.Where(x =>
            x.CrewAssignments.Any(assignment => assignment.CrewUserId == UserId));
        return query;
    }
}

public sealed record BoatDto(Guid Id, Guid OwnerId, string OwnerName, string Name, string RegistrationNumber,
    DateOnly RegistrationDate, string HullNumber, decimal LengthMeters, decimal WidthMeters,
    decimal MaximumSpeedKnots, int MaximumCapacity, int LifeJacketCount,
    string? GpsDeviceId, string Approval, string WildlifeApproval, string? ImageUrl,
    IReadOnlyList<BoatDocumentDto> Documents);
public sealed record BoatDocumentDto(Guid Id, string Name, string FileName, string ContentType,
    DateTimeOffset UploadedAtUtc, DateOnly? ExpirationDate);
public sealed record TripDto(Guid Id, Guid BoatId, string VesselName, string RegistrationNumber, string OwnerName,
    DateTimeOffset ScheduledDepartureUtc, DateTimeOffset? ActualDepartureUtc, DateTimeOffset? ActualArrivalUtc,
    string Route, int PassengerCount, string Status, string ShoreApproval, string WildlifeShoreApproval, string? ShoreNotes,
    DateTimeOffset UpdatedAtUtc, string? InvitationCode, IReadOnlyList<TripCrewDto> Crew, bool HasActiveSos);
public sealed record TripCrewDto(Guid CrewUserId, string Name, string Email, string Position,
    string? NicNumber, bool Certified);
public sealed record TripPassengerDto(Guid Id, string Name, string IdentificationNumber, string PhoneNumber,
    string AgeCategory, string PassengerType, string Gender, DateTimeOffset RegisteredAtUtc);
public sealed record SosAlertDto(Guid Id, Guid TripId, string VesselName, string RegistrationNumber,
    string Location, int PassengersOnboard, string NatureOfEmergency, DateTimeOffset RaisedAtUtc);
public sealed record SosActionDto(Guid Id, Guid SosEventId, string TakenByName, string Details,
    DateTimeOffset TakenAtUtc);
public sealed record SosActionRequest(string? Details);
public sealed record CreateBoatRequest(
    [property: Required, StringLength(160, MinimumLength = 1)] string Name,
    [property: Required, StringLength(64, MinimumLength = 1)] string RegistrationNumber,
    DateOnly RegistrationDate,
    [property: Required, StringLength(64, MinimumLength = 1)] string HullNumber,
    [property: Range(typeof(decimal), "0.01", "100000")] decimal LengthMeters,
    [property: Range(typeof(decimal), "0.01", "100000")] decimal WidthMeters,
    [property: Range(1, 100000)] int MaximumCapacity,
    string? ImageUrl,
    [property: Range(typeof(decimal), "0", "9999.99")] decimal MaximumSpeedKnots = 0,
    [property: Range(0, 100000)] int LifeJacketCount = 0,
    [property: StringLength(128)] string? GpsDeviceId = null);
public sealed record CreateTripRequest(Guid BoatId, DateTimeOffset ScheduledDepartureUtc, string Route,
    int PassengerCount, IReadOnlyList<Guid> CrewUserIds, int ChildrenCount = 0, int SpecialNeedsCount = 0);
public sealed record ApprovalRequest(string Approval, string? Notes);
public sealed record StatusRequest(string Status);
public sealed record OperationsDirectoryDto(IReadOnlyList<DirectoryOwnerDto> Owners,
    IReadOnlyList<DirectoryCrewDto> Crew);
public sealed record DirectoryOwnerDto(Guid Id, string DisplayName, string Email, string? PhoneNumber,
    string? NicNumber, string? Bio);
public sealed record DirectoryCrewDto(Guid Id, string DisplayName, string Email, string? PhoneNumber,
    string Position, Guid? BoatId, Guid OwnerId, string? NicNumber, bool Certified);
public sealed record OwnerCrewDto(Guid AssignmentId, Guid CrewUserId, string Name, string Email,
    string? PhoneNumber, string Position, bool Certified);
public sealed record CrewSuggestionDto(Guid CrewUserId, string Name, string Email, string Position);
public sealed record AddOwnerCrewRequest(string Email);
public sealed record VesselMapDto(Guid Id, string Name, string RegistrationNumber, string? ImageUrl,
    string CertificationApproval, string WildlifeApproval, string ShoreApproval, string WildlifeShoreApproval, bool FullyApproved,
    decimal? Latitude, decimal? Longitude, DateTimeOffset? CoordinatesRecordedAtUtc,
    DateTimeOffset? DepartureUtc, DateTimeOffset? ArrivalUtc, decimal LengthMeters, decimal BeamMeters,
    decimal? CruisingSpeedKnots, decimal MaximumSpeedKnots, int MaximumCapacity, int LifeJacketCount,
    int PassengerCount, int ChildrenCount, int SpecialNeedsCount, int LifeSaverCount, int DiverCount,
    int CoxswainCount);

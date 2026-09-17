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
using WhaleWatching.Api.Gps;
using WhaleWatching.Api.Realtime;

namespace WhaleWatching.Api.Operations;

[ApiController]
[Route("api/operations")]
[Authorize]
public sealed class OperationsController(WhaleWatchingDbContext db, IHubContext<OperationsHub> hub,
    GpsHistoryService gpsHistory, GpsTrackerStatus trackerStatus, TripTrackingService tripTracking,
    BoatDocumentService boatDocuments) : ControllerBase
{
    private const int MaxInlineImageUrlLength = 1_000_000;
    private static readonly TimeSpan MaximumRouteHistoryRange = TimeSpan.FromDays(30);
    private static readonly TimeSpan UnassignedRouteBreak = TimeSpan.FromMinutes(30);

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
                x.CrewUser.IsCrewCertified,
                db.CrewAssignments.Where(a => a.CrewUserId == x.CrewUserId && a.Boat.OwnerId == UserId && a.IsActive)
                    .Select(a => (Guid?)a.BoatId).FirstOrDefault(),
                db.CrewAssignments.Where(a => a.CrewUserId == x.CrewUserId && a.Boat.OwnerId == UserId && a.IsActive)
                    .Select(a => a.Boat.Name).FirstOrDefault())).ToListAsync(ct));
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
            crew.CrewType ?? "Crew Member", crew.IsCrewCertified, null, null));
    }

    [HttpGet("boats/{boatId:guid}/crew")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Ops},{PortalRoles.ShoreCrew},{PortalRoles.BoatOwner}")]
    public async Task<ActionResult<IReadOnlyList<BoatCrewDto>>> BoatCrew(Guid boatId, CancellationToken ct)
    {
        var boat = await ScopeBoats(db.Boats.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == boatId, ct);
        if (boat is null) return NotFound();
        return Ok(await db.CrewAssignments.AsNoTracking().Where(x => x.BoatId == boatId && x.IsActive)
            .OrderBy(x => x.CrewUser.DisplayName).Select(x => new BoatCrewDto(x.CrewUserId,
                x.CrewUser.DisplayName, x.CrewUser.Email!, x.Position, x.CrewUser.IsCrewCertified,
                x.AssignedAtUtc)).ToListAsync(ct));
    }

    [HttpPut("owner/crew/{crewUserId:guid}/boat")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult<OwnerCrewDto>> AssignCrewBoat(Guid crewUserId,
        AssignCrewBoatRequest request, CancellationToken ct)
    {
        var membership = await db.OwnerCrewMemberships.Include(x => x.CrewUser).SingleOrDefaultAsync(x =>
            x.OwnerId == UserId && x.CrewUserId == crewUserId, ct);
        if (membership is null) return NotFound(new { message = "Crew member is not in your crew pool." });
        if (!membership.CrewUser.IsCrewCertified)
            return Conflict(new { message = "Only certified crew can be assigned to a boat." });

        Boat? boat = null;
        if (request.BoatId is not null)
        {
            boat = await db.Boats.SingleOrDefaultAsync(x => x.Id == request.BoatId && x.OwnerId == UserId, ct);
            if (boat is null) return Forbid();
        }

        var assignments = await db.CrewAssignments.Where(x => x.CrewUserId == crewUserId &&
            x.Boat.OwnerId == UserId).ToListAsync(ct);
        foreach (var item in assignments) item.IsActive = false;
        if (boat is not null)
        {
            var assignment = assignments.SingleOrDefault(x => x.BoatId == boat.Id);
            if (assignment is null)
            {
                assignment = new CrewAssignment { Id = Guid.NewGuid(), BoatId = boat.Id,
                    CrewUserId = crewUserId, Position = string.IsNullOrWhiteSpace(request.Position)
                        ? membership.CrewUser.CrewType ?? "Crew Member" : request.Position.Trim() };
                db.CrewAssignments.Add(assignment);
            }
            assignment.IsActive = true;
            assignment.AssignedAtUtc = DateTimeOffset.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "boatCrewAssignment", crewUserId }, ct);
        return Ok(new OwnerCrewDto(membership.Id, crewUserId, membership.CrewUser.DisplayName,
            membership.CrewUser.Email!, membership.CrewUser.PhoneNumber,
            membership.CrewUser.CrewType ?? "Crew Member", membership.CrewUser.IsCrewCertified,
            boat?.Id, boat?.Name));
    }

    [HttpDelete("owner/crew/{assignmentId:guid}")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<IActionResult> RemoveOwnerCrew(Guid assignmentId, CancellationToken ct)
    {
        var membership = await db.OwnerCrewMemberships.SingleOrDefaultAsync(x =>
            x.Id == assignmentId && x.OwnerId == UserId, ct);
        if (membership is null) return NotFound();
        var assignments = await db.CrewAssignments.Where(x => x.CrewUserId == membership.CrewUserId &&
            x.Boat.OwnerId == UserId && x.IsActive).ToListAsync(ct);
        foreach (var assignment in assignments) assignment.IsActive = false;
        db.OwnerCrewMemberships.Remove(membership); await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "crew", id = membership.Id }, ct);
        return NoContent();
    }

    [HttpGet("boats")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.Ops},{PortalRoles.ShoreCrew},{PortalRoles.BoatOwner},{PortalRoles.BoatCrew}")]
    public async Task<ActionResult<IReadOnlyList<BoatDto>>> Boats(CancellationToken ct)
    {
        var scopedBoats = ScopeBoats(db.Boats.AsNoTracking());
        if (!User.IsInRole(PortalRoles.BoatOwner))
            scopedBoats = scopedBoats.Where(x => x.DocumentRequirementsVersion < BoatDocumentRequirements.CurrentVersion ||
                x.RegistrationSubmittedAtUtc != null);
        var query = scopedBoats.OrderBy(x => x.Name);
        var boats = await query.Select(x => new
        {
            x.Id, x.OwnerId, OwnerName = x.Owner.DisplayName, x.Name, x.RegistrationNumber,
            x.RegistrationDate, x.HullNumber, x.LengthMeters, x.WidthMeters, x.MaximumSpeedKnots,
            x.MaximumCapacity, x.LifeJacketCount, x.GpsDeviceId, x.IsPatrolBoat, x.Approval, x.WildlifeApproval,
            x.DocumentRequirementsVersion, x.RegistrationSubmittedAtUtc,
            ImageUrl = x.ImageUrl != null && x.ImageUrl.Length <= MaxInlineImageUrlLength ? x.ImageUrl : null
        }).ToListAsync(ct);
        var boatIds = boats.Select(boat => boat.Id).ToArray();
        var documents = await db.BoatDocuments.AsNoTracking().Where(document => boatIds.Contains(document.BoatId))
            .Include(document => document.UploadedByUser).Include(document => document.VerifiedByUser)
            .OrderBy(document => document.Name).ThenByDescending(document => document.Version).ToListAsync(ct);
        var documentsByBoat = documents.ToLookup(document => document.BoatId, ToBoatDocumentDto);

        return Ok(boats.Select(boat => new BoatDto(boat.Id, boat.OwnerId, boat.OwnerName, boat.Name,
            boat.RegistrationNumber, boat.RegistrationDate, boat.HullNumber, boat.LengthMeters, boat.WidthMeters,
            boat.MaximumSpeedKnots, boat.MaximumCapacity, boat.LifeJacketCount, boat.GpsDeviceId, boat.IsPatrolBoat,
            boat.Approval.ToString(), boat.WildlifeApproval.ToString(), boat.ImageUrl,
            boat.DocumentRequirementsVersion, boat.RegistrationSubmittedAtUtc,
            documentsByBoat[boat.Id].ToArray())).ToList());
    }

    [HttpGet("vessel-map")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.Ops},{PortalRoles.ShoreCrew},{PortalRoles.BoatOwner},{PortalRoles.BoatCrew}")]
    public async Task<ActionResult<IReadOnlyList<VesselMapDto>>> VesselMap(CancellationToken ct)
    {
        var boats = await ScopeBoats(db.Boats.AsNoTracking()).OrderBy(x => x.Name)
            .ToListAsync(ct);
        var boatIds = boats.Select(x => x.Id).ToArray();
        var trips = await ScopeTrips(db.Trips.AsNoTracking()).Where(x =>
                boatIds.Contains(x.BoatId) && x.Status == TripStatus.Ongoing)
            .Include(x => x.CrewAssignments).ThenInclude(x => x.CrewUser)
            .OrderByDescending(x => x.ActualDepartureUtc ?? x.ScheduledDepartureUtc).ToListAsync(ct);
        var activeTripIds = trips.Select(x => x.Id).ToArray();
        var onboardByTrip = await db.TripPassengers.AsNoTracking()
            .Where(x => activeTripIds.Contains(x.TripId) && x.Attendance != null &&
                x.Attendance.Status == PassengerAttendanceStatus.Present)
            .GroupBy(x => x.TripId)
            .Select(group => new
            {
                TripId = group.Key,
                Passengers = group.Count(),
                Children = group.Count(x => x.Passenger.AgeCategory == "child"),
                SpecialNeeds = group.Count(x => x.Passenger.AgeCategory == "specialneeds")
            })
            .ToDictionaryAsync(x => x.TripId, ct);
        var deviceIds = boats.Where(x => x.GpsDeviceId != null).Select(x => x.GpsDeviceId!).ToArray();
        var telemetry = await db.GpsTelemetry.AsNoTracking().Where(x => deviceIds.Contains(x.DeviceId))
            .GroupBy(x => x.DeviceId).Select(group => group.OrderByDescending(x => x.RecordedAtUtc).First())
            .ToListAsync(ct);

        return Ok(boats.Select(boat =>
        {
            var trip = trips.FirstOrDefault(x => x.BoatId == boat.Id && x.Status == TripStatus.Ongoing);
            var onboard = trip is not null && onboardByTrip.TryGetValue(trip.Id, out var counts) ? counts : null;
            var gps = telemetry.FirstOrDefault(x => x.DeviceId == boat.GpsDeviceId);
            var crew = trip?.CrewAssignments ?? [];
            return new VesselMapDto(boat.Id, boat.Name, boat.RegistrationNumber, boat.ImageUrl, boat.IsPatrolBoat,
                trip?.Id,
                boat.Approval.ToString(), boat.WildlifeApproval.ToString(),
                trip?.Status.ToString() ?? "Idle",
                gps?.Latitude, gps?.Longitude, gps?.RecordedAtUtc, gps?.ReceivedAtUtc,
                trackerStatus.Classify(gps?.RecordedAtUtc), gps?.HeadingDegrees, gps?.AltitudeMeters,
                trip?.ActualDepartureUtc,
                trip?.ActualArrivalUtc, boat.LengthMeters, boat.WidthMeters, gps?.SpeedKnots,
                boat.MaximumSpeedKnots, boat.MaximumCapacity, boat.LifeJacketCount,
                onboard?.Passengers ?? 0, onboard?.Children ?? 0, onboard?.SpecialNeeds ?? 0,
                crew.Count(x => (x.CrewUser.CrewType ?? "").Contains("Life Saver")),
                crew.Count(x => (x.CrewUser.CrewType ?? "").Contains("Diver")),
                crew.Count(x => (x.CrewUser.CrewType ?? "").Contains("Coxswain")));
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
                x.ActualArrivalUtc, x.Route, x.PassengerCount, x.Type.ToString(), x.Status.ToString(),
                x.ShoreNotes, x.UpdatedAtUtc, x.InvitationCode,
                x.CrewAssignments.OrderBy(a => a.CrewUser.DisplayName).Select(a => new TripCrewDto(
                    a.CrewUserId, a.CrewUser.DisplayName, a.CrewUser.Email!,
                    a.Position == "" ? (a.CrewUser.CrewType ?? "Crew Member") : a.Position, a.CrewUser.NicNumber,
                    a.CrewUser.IsCrewCertified)).ToList(),
                db.SosEvents.Any(s => s.TripId == x.Id && s.ResolvedAtUtc == null),
                x.PassengerVerificationFinalizedAtUtc, x.StartedByUserId, x.StartedByRole,
                x.DeclineReason, x.DeclinedByUserId, x.DeclinedAtUtc, x.RescheduleOverride,
                x.RescheduleOverrideByUserId, x.RescheduleOverrideAtUtc,
                x.RescheduleOverrideReason)).ToListAsync(ct));
    }

    [HttpGet("trips/{id:guid}/crew")]
    public async Task<ActionResult<IReadOnlyList<TripCrewDto>>> TripCrew(Guid id, CancellationToken ct)
    {
        if (!await ScopeTrips(db.Trips.AsNoTracking()).AnyAsync(x => x.Id == id, ct)) return NotFound();
        return Ok(await db.TripCrewAssignments.AsNoTracking().Where(x => x.TripId == id)
            .OrderBy(x => x.CrewUser.DisplayName).Select(x => new TripCrewDto(x.CrewUserId,
                x.CrewUser.DisplayName, x.CrewUser.Email!, x.Position == "" ?
                    (x.CrewUser.CrewType ?? "Crew Member") : x.Position,
                x.CrewUser.NicNumber, x.CrewUser.IsCrewCertified)).ToListAsync(ct));
    }

    [HttpGet("trips/{id:guid}/tracking-summary")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.Ops},{PortalRoles.ShoreCrew},{PortalRoles.BoatOwner},{PortalRoles.BoatCrew}")]
    public async Task<ActionResult<TripTrackingSummaryDto>> TripTrackingSummary(Guid id, CancellationToken ct)
    {
        if (!await ScopeTrips(db.Trips.AsNoTracking()).AnyAsync(x => x.Id == id, ct))
            return NotFound();
        var snapshot = await tripTracking.GetAsync(id, User.IsInRole(PortalRoles.Ops), ct);
        if (snapshot is null) return NotFound();
        var route = snapshot.Route.Select(ToRoutePoint).ToList();
        return Ok(new TripTrackingSummaryDto(snapshot.TripId, snapshot.BoatId, snapshot.Status,
            snapshot.StartedAtUtc, snapshot.EndedAtUtc, snapshot.RouteLengthKilometers, "km",
            snapshot.MoveDurationSeconds, snapshot.StopsDurationSeconds, snapshot.AverageSpeedKnots,
            "knots", route.LastOrDefault(), route, snapshot.Stops.Select(ToStopDto).ToList()));
    }

    [HttpGet("boats/{boatId:guid}/route-history")]
    [Authorize(Roles = PortalRoles.Ops)]
    public async Task<ActionResult<BoatRouteHistoryDto>> BoatRouteHistory(Guid boatId,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct)
    {
        if (from is null || to is null)
            return ValidationProblem("Both from and to timestamps are required.");
        if (to <= from)
            return ValidationProblem("The route history end must be after the start.");
        if (to - from > MaximumRouteHistoryRange)
            return ValidationProblem("Route history is limited to a maximum of 30 days.");

        var boat = await ScopeBoats(db.Boats.AsNoTracking())
            .Where(x => x.Id == boatId)
            .Select(x => new { x.Id, x.GpsDeviceId })
            .SingleOrDefaultAsync(ct);
        if (boat is null) return NotFound();

        await gpsHistory.EnsureRangeAsync(boat.GpsDeviceId, from.Value, to.Value, ct);

        var lastKnown = boat.GpsDeviceId is null ? null : await db.GpsTelemetry.AsNoTracking()
            .Where(x => x.DeviceId == boat.GpsDeviceId && x.Latitude >= -90 && x.Latitude <= 90 &&
                x.Longitude >= -180 && x.Longitude <= 180)
            .OrderByDescending(x => x.RecordedAtUtc).ThenByDescending(x => x.Id)
            .Select(x => new TripRoutePointDto(x.Latitude, x.Longitude, x.RecordedAtUtc,
                x.SpeedKnots, x.HeadingDegrees))
            .FirstOrDefaultAsync(ct);

        var historyTrips = await ScopeTrips(db.Trips.AsNoTracking())
            .Where(x => x.BoatId == boatId && x.ActualDepartureUtc != null && x.ActualDepartureUtc <= to &&
                (x.ActualArrivalUtc == null || x.ActualArrivalUtc >= from))
            .OrderBy(x => x.ActualDepartureUtc).ThenBy(x => x.Id)
            .Select(x => new HistoricalTripRecord(x.Id, x.Route, x.ActualDepartureUtc!.Value,
                x.ActualArrivalUtc, x.Status.ToString()))
            .ToListAsync(ct);

        List<TrackingTelemetryPoint> telemetry = [];
        if (boat.GpsDeviceId is not null)
            telemetry = await db.GpsTelemetry.AsNoTracking()
                .Where(x => x.DeviceId == boat.GpsDeviceId && x.RecordedAtUtc >= from &&
                    x.RecordedAtUtc <= to && x.Latitude >= -90 && x.Latitude <= 90 &&
                    x.Longitude >= -180 && x.Longitude <= 180)
                .OrderBy(x => x.RecordedAtUtc).ThenBy(x => x.Id)
                .Select(x => new TrackingTelemetryPoint(x.Latitude, x.Longitude, x.RecordedAtUtc,
                    x.SpeedKnots, x.HeadingDegrees))
                .ToListAsync(ct);

        var tripPoints = historyTrips.ToDictionary(x => x.Id, _ => new List<TrackingTelemetryPoint>());
        var unassignedPointGroups = new List<List<TrackingTelemetryPoint>>();
        List<TrackingTelemetryPoint>? currentUnassignedGroup = null;
        foreach (var point in telemetry)
        {
            var matchingTrip = historyTrips.FirstOrDefault(x => point.RecordedAtUtc >= x.StartedAtUtc &&
                point.RecordedAtUtc <= (x.EndedAtUtc ?? to.Value));
            if (matchingTrip is not null)
            {
                currentUnassignedGroup = null;
                tripPoints[matchingTrip.Id].Add(point);
                continue;
            }

            if (currentUnassignedGroup is null ||
                point.RecordedAtUtc - currentUnassignedGroup[^1].RecordedAtUtc > UnassignedRouteBreak)
            {
                currentUnassignedGroup = [];
                unassignedPointGroups.Add(currentUnassignedGroup);
            }
            currentUnassignedGroup.Add(point);
        }

        var tripRoutes = historyTrips.Select(trip =>
        {
            var points = tripPoints[trip.Id];
            var segmentStart = trip.StartedAtUtc < from.Value ? from.Value : trip.StartedAtUtc;
            var tripEnd = trip.EndedAtUtc ?? to.Value;
            var segmentEnd = tripEnd > to.Value ? to.Value : tripEnd;
            var metrics = tripTracking.CalculateMetrics(segmentStart, segmentEnd, points);
            var stops = tripTracking.DetectStops(points);
            return new BoatHistoricalTripDto(trip.Id, trip.Route, trip.Status, trip.StartedAtUtc,
                trip.EndedAtUtc, metrics?.RouteLengthKilometers, metrics?.MoveDurationSeconds,
                metrics?.StopsDurationSeconds, metrics?.AverageSpeedKnots,
                points.Select(ToRoutePoint).ToList(), stops.Select(ToStopDto).ToList());
        }).ToList();

        var unassignedRoutes = unassignedPointGroups.Select((points, index) =>
        {
            var metrics = tripTracking.CalculateMetrics(points[0].RecordedAtUtc,
                points[^1].RecordedAtUtc, points);
            var stops = tripTracking.DetectStops(points);
            return new BoatHistoricalRouteDto(index + 1, points[0].RecordedAtUtc, points[^1].RecordedAtUtc,
                metrics?.RouteLengthKilometers, metrics?.MoveDurationSeconds, metrics?.StopsDurationSeconds,
                metrics?.AverageSpeedKnots, points.Select(ToRoutePoint).ToList(),
                stops.Select(ToStopDto).ToList());
        }).ToList();

        var allMetrics = tripRoutes.Select(x => new { x.RouteLength, x.MoveDurationSeconds, x.StopsDurationSeconds })
            .Concat(unassignedRoutes.Select(x => new { x.RouteLength, x.MoveDurationSeconds, x.StopsDurationSeconds }))
            .ToList();
        var totalDistance = Math.Round(allMetrics.Sum(x => x.RouteLength ?? 0), 3);
        var totalMovingSeconds = allMetrics.Sum(x => x.MoveDurationSeconds ?? 0);
        var totalStopsSeconds = allMetrics.Sum(x => x.StopsDurationSeconds ?? 0);
        var averageSpeed = totalMovingSeconds > 0
            ? Math.Round((decimal)(totalDistance / TripTrackingCalculator.KilometersPerNauticalMile /
                (totalMovingSeconds / 3600d)), 2)
            : (decimal?)null;

        return Ok(new BoatRouteHistoryDto(boat.Id, from.Value, to.Value,
            new BoatRouteHistorySummaryDto(totalDistance, "km", tripRoutes.Count, totalMovingSeconds,
                totalStopsSeconds, averageSpeed, "knots"), lastKnown, tripRoutes, unassignedRoutes));
    }

    private static TripRoutePointDto ToRoutePoint(TrackingTelemetryPoint point) =>
        new(point.Latitude, point.Longitude, point.RecordedAtUtc, point.SpeedKnots, point.HeadingDegrees);

    private static TripStopDto ToStopDto(TrackingStop stop) => new(stop.StartedAtUtc,
        stop.EndedAtUtc, stop.DurationSeconds, stop.Latitude, stop.Longitude, stop.IsOngoing,
        stop.SpeedKnots);

    [HttpGet("sos")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.Ops},{PortalRoles.ShoreCrew},{PortalRoles.BoatOwner},{PortalRoles.BoatCrew}")]
    public async Task<ActionResult<IReadOnlyList<SosAlertDto>>> SosAlerts(CancellationToken ct)
    {
        var allowedTrips = ScopeTrips(db.Trips.AsNoTracking()).Select(x => x.Id);
        var alerts = await db.SosEvents.AsNoTracking().Where(x => x.ResolvedAtUtc == null && allowedTrips.Contains(x.TripId))
            .OrderByDescending(x => x.RaisedAtUtc)
            .Select(x => new { x.Id, x.TripId, x.Trip.BoatId, VesselName = x.Trip.Boat.Name,
                x.Trip.Boat.RegistrationNumber, PassengersOnboard = x.Trip.PassengerCount,
                NatureOfEmergency = x.Message, x.RaisedAtUtc, HasActions = x.Actions.Any() }).ToListAsync(ct);
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
                x.PassengersOnboard, x.NatureOfEmergency, x.RaisedAtUtc, x.HasActions);
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
            .Select(x => new SosActionDto(x.Id, x.SosEventId,
                x.ResponderName == string.Empty ? x.TakenByUser.DisplayName : x.ResponderName,
                x.ResponderIdNumber == string.Empty ? "Not recorded" : x.ResponderIdNumber,
                x.Details, x.TakenAtUtc)).ToListAsync(ct));
    }

    [HttpPost("trips/{id:guid}/sos-actions")]
    [Authorize(Roles = PortalRoles.Ops)]
    public async Task<ActionResult<SosActionDto>> AddSosAction(Guid id, SosActionRequest request, CancellationToken ct)
    {
        var responderName = request.ResponderName?.Trim() ?? string.Empty;
        if (responderName.Length is < 1 or > 160)
            return ValidationProblem("Responder name must contain between 1 and 160 characters.");

        var responderIdNumber = request.ResponderIdNumber?.Trim() ?? string.Empty;
        if (responderIdNumber.Length is < 1 or > 32)
            return ValidationProblem("Responder ID number must contain between 1 and 32 characters.");

        var details = request.Details?.Trim() ?? string.Empty;
        if (details.Length is < 1 or > 1000)
            return ValidationProblem("Action details must contain between 1 and 1000 characters.");

        var sos = await db.SosEvents.Where(x => x.TripId == id && x.ResolvedAtUtc == null)
            .OrderByDescending(x => x.RaisedAtUtc).FirstOrDefaultAsync(ct);
        if (sos is null) return Conflict(new { message = "This trip has no active SOS alert." });

        var action = new SosAction { Id = Guid.NewGuid(), SosEventId = sos.Id,
            TakenByUserId = UserId, ResponderName = responderName,
            ResponderIdNumber = responderIdNumber, Details = details, TakenAtUtc = DateTimeOffset.UtcNow };
        db.SosActions.Add(action);
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "sosAction", id = action.Id, tripId = id }, ct);
        return Created($"/api/operations/trips/{id}/sos-actions/{action.Id}",
            new SosActionDto(action.Id, action.SosEventId, action.ResponderName,
                action.ResponderIdNumber, action.Details, action.TakenAtUtc));
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
                x.Passenger.PassengerType, x.Passenger.CountryCode, x.Passenger.Gender,
                x.RegisteredAtUtc)).ToListAsync(ct));
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
            Approval = ApprovalStatus.Pending, WildlifeApproval = ApprovalStatus.Pending, ImageUrl = request.ImageUrl,
            DocumentRequirementsVersion = BoatDocumentRequirements.CurrentVersion };
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
        if (User.IsInRole(PortalRoles.Wildlife) && !User.IsInRole(PortalRoles.Admin))
        {
            if (approval == ApprovalStatus.Approved)
            {
                var validation = await boatDocuments.ValidateWildlifeApprovalAsync(id, ct);
                if (!validation.Succeeded) return Conflict(new { message = validation.Error });
            }
            boat.WildlifeApproval = approval;
        }
        else
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
                 x.Status == TripStatus.NeedsReschedule || x.Status == TripStatus.Ongoing), ct))
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
    [RequestSizeLimit(11 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 11 * 1024 * 1024)]
    public async Task<ActionResult<BoatDocumentDto>> UploadBoatDocument(Guid boatId,
        [FromForm] string documentType, [FromForm] IFormFile file, CancellationToken ct)
    {
        var result = await boatDocuments.UploadAsync(boatId, UserId, documentType, file, ct);
        if (result.Forbidden) return Forbid();
        if (result.Document is null) return ValidationProblem(result.Error ?? "Document upload failed.");
        var document = result.Document;
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "boatDocument", id = document.Id, boatId }, ct);
        return Created($"api/operations/boats/{boatId}/documents/{document.Id}",
            ToBoatDocumentDto(document));
    }

    [HttpPost("boats/{boatId:guid}/submit")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<IActionResult> SubmitBoatRegistration(Guid boatId, CancellationToken ct)
    {
        var result = await boatDocuments.SubmitRegistrationAsync(boatId, UserId, ct);
        if (!result.Succeeded) return Conflict(new { message = result.Error });
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "boat", id = boatId }, ct);
        return NoContent();
    }

    [HttpGet("boats/{boatId:guid}/documents")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.Ops},{PortalRoles.ShoreCrew},{PortalRoles.BoatOwner},{PortalRoles.BoatCrew}")]
    public async Task<ActionResult<IReadOnlyList<BoatDocumentDto>>> GetBoatDocuments(Guid boatId,
        [FromQuery] bool currentOnly = false, [FromQuery] string? documentType = null, CancellationToken ct = default)
    {
        if (!await ScopeBoats(db.Boats.AsNoTracking()).AnyAsync(x => x.Id == boatId, ct)) return NotFound();
        var query = db.BoatDocuments.AsNoTracking().Where(x => x.BoatId == boatId);
        if (currentOnly) query = query.Where(x => x.IsCurrent);
        if (!string.IsNullOrWhiteSpace(documentType)) query = query.Where(x => x.DocumentType == documentType);
        var documents = await query.Include(x => x.UploadedByUser).Include(x => x.VerifiedByUser)
            .OrderBy(x => x.DocumentType).ThenByDescending(x => x.Version).ToListAsync(ct);
        return Ok(documents.Select(ToBoatDocumentDto).ToArray());
    }

    [HttpPatch("boats/{boatId:guid}/documents/{documentId:guid}/review")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife}")]
    public async Task<IActionResult> ReviewBoatDocument(Guid boatId, Guid documentId,
        ReviewBoatDocumentRequest request, CancellationToken ct)
    {
        var result = await boatDocuments.ReviewAsync(boatId, documentId, UserId, request.Status,
            request.ExpirationDate, request.RejectionReason, ct);
        if (!result.Succeeded) return Conflict(new { message = result.Error });
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "boatDocument", id = documentId, boatId }, ct);
        return NoContent();
    }

    [HttpGet("boats/{boatId:guid}/documents/{documentId:guid}")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.Ops},{PortalRoles.ShoreCrew},{PortalRoles.BoatOwner},{PortalRoles.BoatCrew}")]
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
        var usesBoatCrew = selectedCrewIds.Length == 0;
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var boat = await db.Boats.SingleOrDefaultAsync(x => x.Id == request.BoatId && x.OwnerId == UserId, ct);
            if (boat is null) return Forbid();
            if (boat.IsPatrolBoat)
                return Conflict(new { message = "Patrol vessels are managed through the OPS patrol workflow." });

            var crewIds = selectedCrewIds;
            if (usesBoatCrew)
            {
                crewIds = await db.CrewAssignments.Where(x => x.BoatId == boat.Id && x.IsActive &&
                        x.CrewUser.IsCrewCertified && !db.TripCrewAssignments.Any(tripAssignment =>
                            tripAssignment.CrewUserId == x.CrewUserId &&
                            tripAssignment.Trip.ScheduledDepartureUtc == request.ScheduledDepartureUtc &&
                            (tripAssignment.Trip.Status == TripStatus.Scheduled ||
                             tripAssignment.Trip.Status == TripStatus.Boarding ||
                             tripAssignment.Trip.Status == TripStatus.NeedsReschedule ||
                             tripAssignment.Trip.Status == TripStatus.Ongoing)))
                    .OrderBy(x => x.CrewUser.DisplayName).Select(x => x.CrewUserId).ToArrayAsync(ct);
                if (crewIds.Length == 0)
                    return ValidationProblem("Assign certified crew to this boat before scheduling a trip.");
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
                PassengerCount = request.PassengerCount, Type = TripType.WhaleWatching, Status = TripStatus.Scheduled,
                ChildrenCount = request.ChildrenCount, SpecialNeedsCount = request.SpecialNeedsCount,
                ShoreApproval = ApprovalStatus.Pending, WildlifeShoreApproval = ApprovalStatus.Pending,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
                InvitationCode = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32)) };
            db.Trips.Add(trip);
            Dictionary<Guid, string> roles;
            if (usesBoatCrew)
                roles = await db.CrewAssignments.Where(x => x.BoatId == boat.Id && x.IsActive &&
                        crewIds.Contains(x.CrewUserId))
                    .ToDictionaryAsync(x => x.CrewUserId, x => x.Position, ct);
            else
                roles = await db.Users.Where(x => crewIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id,
                    x => x.CrewType ?? "Crew Member", ct);
            if (!roles.Values.Any(x => x.Contains("Coxswain", StringComparison.OrdinalIgnoreCase)))
                return ValidationProblem("The trip crew must include a certified coxswain.");
            db.TripCrewAssignments.AddRange(crewIds.Select(crewId => new TripCrewAssignment {
                Id = Guid.NewGuid(), TripId = trip.Id, CrewUserId = crewId,
                Position = roles[crewId], Source = usesBoatCrew ? "BoatDefault" : "TripOverride" }));
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            await hub.Clients.All.SendAsync("operationsChanged", new { entity = "trip", id = trip.Id }, ct);
            return Created($"api/operations/trips/{trip.Id}", new {
                trip.Id, crewUserIds = crewIds, crewAutoAssigned = usesBoatCrew });
        });
    }

    [HttpPut("trips/{id:guid}/crew")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult<IReadOnlyList<TripCrewDto>>> UpdateTripCrew(Guid id,
        UpdateTripCrewRequest request, CancellationToken ct)
    {
        var crewIds = request.CrewUserIds.Distinct().ToArray();
        if (crewIds.Length == 0) return ValidationProblem("Select at least one crew member.");
        var trip = await db.Trips.Include(x => x.Boat).Include(x => x.CrewAssignments)
            .SingleOrDefaultAsync(x => x.Id == id && x.Boat.OwnerId == UserId, ct);
        if (trip is null) return NotFound();
        if (!TripWorkflowRules.CanReschedule(trip.Status))
            return Conflict(new { message = "Crew can only be changed before a trip starts." });
        var crew = await db.OwnerCrewMemberships.Where(x => x.OwnerId == UserId &&
                crewIds.Contains(x.CrewUserId) && x.CrewUser.IsCrewCertified)
            .Select(x => new { x.CrewUserId, x.CrewUser.DisplayName, x.CrewUser.Email,
                Position = x.CrewUser.CrewType ?? "Crew Member", x.CrewUser.NicNumber,
                x.CrewUser.IsCrewCertified }).ToListAsync(ct);
        if (crew.Count != crewIds.Length)
            return ValidationProblem("Every selected crew member must be certified and belong to your crew.");
        if (!crew.Any(x => x.Position.Contains("Coxswain", StringComparison.OrdinalIgnoreCase)))
            return ValidationProblem("The trip crew must include a certified coxswain.");
        var unavailable = await db.TripCrewAssignments.AnyAsync(x => x.TripId != id &&
            crewIds.Contains(x.CrewUserId) && x.Trip.ScheduledDepartureUtc == trip.ScheduledDepartureUtc &&
            (x.Trip.Status == TripStatus.Scheduled || x.Trip.Status == TripStatus.Boarding ||
             x.Trip.Status == TripStatus.NeedsReschedule || x.Trip.Status == TripStatus.Ongoing), ct);
        if (unavailable) return Conflict(new { message = "A selected crew member is assigned to another trip at this time." });
        db.TripCrewAssignments.RemoveRange(trip.CrewAssignments);
        db.TripCrewAssignments.AddRange(crew.Select(x => new TripCrewAssignment { Id = Guid.NewGuid(),
            TripId = id, CrewUserId = x.CrewUserId, Position = x.Position, Source = "TripOverride" }));
        trip.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "tripCrew", id }, ct);
        return Ok(crew.Select(x => new TripCrewDto(x.CrewUserId, x.DisplayName, x.Email!,
            x.Position, x.NicNumber, x.IsCrewCertified)).ToList());
    }

    [HttpPost("patrol-trips/start")]
    [Authorize(Roles = PortalRoles.Ops)]
    public async Task<ActionResult<StartPatrolResult>> StartPatrol(StartPatrolRequest request, CancellationToken ct)
    {
        var route = string.IsNullOrWhiteSpace(request.Route) ? "SLCG patrol" : request.Route.Trim();
        var strategy = db.Database.CreateExecutionStrategy();
        var result = await strategy.ExecuteAsync<ActionResult<StartPatrolResult>>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var boat = await db.Boats.SingleOrDefaultAsync(x => x.Id == request.BoatId && x.IsPatrolBoat, ct);
            if (boat is null) return NotFound(new { message = "The selected SLCG patrol vessel was not found." });
            if (string.IsNullOrWhiteSpace(boat.GpsDeviceId))
                return Conflict(new { message = "A GPS tracker must be assigned before this patrol can start." });

            var alreadyActive = await db.Trips.AnyAsync(x => x.BoatId == boat.Id &&
                (x.Status == TripStatus.Boarding || x.Status == TripStatus.Ongoing), ct);
            if (alreadyActive)
                return Conflict(new { message = "This vessel already has an active trip or patrol." });

            var now = DateTimeOffset.UtcNow;
            var trip = new Trip
            {
                Id = Guid.NewGuid(),
                BoatId = boat.Id,
                ScheduledDepartureUtc = now,
                ActualDepartureUtc = now,
                Route = route,
                Type = TripType.Patrol,
                Status = TripStatus.Ongoing,
                ShoreApproval = ApprovalStatus.Approved,
                WildlifeShoreApproval = ApprovalStatus.Approved,
                UpdatedAtUtc = now
            };
            db.Trips.Add(trip);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Created($"api/operations/trips/{trip.Id}", new StartPatrolResult(trip.Id, boat.Id, now));
        });

        if (result.Result is CreatedResult created && created.Value is StartPatrolResult patrol)
            await hub.Clients.All.SendAsync("operationsChanged", new { entity = "trip", id = patrol.Id }, ct);
        return result;
    }

    [HttpPatch("trips/{id:guid}/reschedule")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult> RescheduleTrip(Guid id, RescheduleTripRequest request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        if (request.ScheduledDepartureUtc <= now)
            return ValidationProblem("The new scheduled departure must be in the future.");

        var trip = await db.Trips.Include(x => x.Boat).Include(x => x.CrewAssignments)
            .SingleOrDefaultAsync(x => x.Id == id && x.Boat.OwnerId == UserId, ct);
        if (trip is null) return NotFound();
        if (!TripWorkflowRules.CanReschedule(trip.Status))
            return Conflict(new { message = "Only a scheduled trip can be rescheduled." });

        var crewIds = trip.CrewAssignments.Select(x => x.CrewUserId).ToArray();
        var crewUnavailable = crewIds.Length > 0 && await db.TripCrewAssignments.AnyAsync(x =>
            x.TripId != id && crewIds.Contains(x.CrewUserId) &&
            x.Trip.ScheduledDepartureUtc == request.ScheduledDepartureUtc &&
            (x.Trip.Status == TripStatus.Scheduled || x.Trip.Status == TripStatus.Boarding ||
             x.Trip.Status == TripStatus.NeedsReschedule || x.Trip.Status == TripStatus.Ongoing), ct);
        if (crewUnavailable)
            return Conflict(new { message = "A selected crew member is already assigned to another trip at the new date and time." });

        trip.ScheduledDepartureUtc = request.ScheduledDepartureUtc;
        if (trip.Status == TripStatus.NeedsReschedule) trip.Status = TripStatus.Scheduled;
        trip.UpdatedAtUtc = now;

        // Keep the same trip, invitation QR and passengers. Existing passenger sessions are extended so
        // passengers who already joined can return to their portal after the trip is rescheduled.
        var sessionExpiry = PassengerSessionPolicy.GetExpiry(request.ScheduledDepartureUtc, now);
        var sessions = await db.PassengerSessions.Where(x => x.TripId == id).ToListAsync(ct);
        foreach (var session in sessions)
            if (session.ExpiresAtUtc < sessionExpiry) session.ExpiresAtUtc = sessionExpiry;

        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "trip", id }, ct);
        return NoContent();
    }

    [HttpPost("trips/{id:guid}/start")]
    [Authorize(Roles = $"{PortalRoles.ShoreCrew},{PortalRoles.Admin}")]
    public async Task<ActionResult> StartTrip(Guid id, StartTripRequest request, CancellationToken ct)
    {
        var trip = await db.Trips.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (trip is null) return NotFound();
        if (trip.Type == TripType.Patrol) return Conflict(new { message = "Patrol trips use the OPS patrol workflow." });
        if (!TripWorkflowRules.CanStart(trip.Status))
            return Conflict(new { message = $"A {trip.Status} trip cannot be started." });
        if (trip.PassengerVerificationFinalizedAtUtc is null)
            return Conflict(new { message = "Passenger confirmation must be finalized before the trip can start." });
        var isOverride = trip.Status == TripStatus.NeedsReschedule;
        if (isOverride && !request.ConfirmRescheduleOverride)
            return Conflict(new { message = "Confirm the Needs Reschedule override before starting this trip." });
        var now = DateTimeOffset.UtcNow;
        trip.Status = TripStatus.Ongoing;
        trip.ActualDepartureUtc = now;
        trip.StartedByUserId = UserId;
        trip.StartedByRole = User.IsInRole(PortalRoles.ShoreCrew)
            ? PortalRoles.ShoreCrew : PortalRoles.Admin;
        trip.UpdatedAtUtc = now;
        if (isOverride)
        {
            trip.RescheduleOverride = true;
            trip.RescheduleOverrideByUserId = UserId;
            trip.RescheduleOverrideAtUtc = now;
            trip.RescheduleOverrideReason = request.OverrideReason?.Trim();
        }
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = isOverride ? "tripStartedWithOverride" : "tripStarted", id }, ct);
        return NoContent();
    }

    [HttpPost("trips/{id:guid}/decline")]
    [Authorize(Roles = $"{PortalRoles.ShoreCrew},{PortalRoles.Admin}")]
    public async Task<ActionResult> DeclineTrip(Guid id, DeclineTripRequest request, CancellationToken ct)
    {
        var trip = await db.Trips.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (trip is null) return NotFound();
        if (!TripWorkflowRules.CanDecline(trip.Status))
            return Conflict(new { message = $"A {trip.Status} trip cannot be declined." });
        var now = DateTimeOffset.UtcNow;
        trip.Status = TripStatus.Declined;
        trip.DeclineReason = request.Reason?.Trim();
        trip.DeclinedByUserId = UserId;
        trip.DeclinedAtUtc = now;
        trip.UpdatedAtUtc = now;
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "tripDeclined", id }, ct);
        return NoContent();
    }

    [HttpPost("trips/{id:guid}/end")]
    [Authorize(Roles = $"{PortalRoles.BoatOwner},{PortalRoles.BoatCrew},{PortalRoles.Ops},{PortalRoles.Admin}")]
    public async Task<ActionResult> EndTrip(Guid id, CancellationToken ct)
    {
        var trip = await db.Trips.Include(x => x.Boat).Include(x => x.CrewAssignments)
            .SingleOrDefaultAsync(x => x.Id == id, ct);
        if (trip is null) return NotFound();
        var authorized = User.IsInRole(PortalRoles.Admin) || User.IsInRole(PortalRoles.Ops) ||
            (User.IsInRole(PortalRoles.BoatOwner) && trip.Boat.OwnerId == UserId) ||
            (User.IsInRole(PortalRoles.BoatCrew) && trip.CrewAssignments.Any(x => x.CrewUserId == UserId));
        if (!authorized) return Forbid();
        if (!TripWorkflowRules.CanEnd(trip.Status))
            return Conflict(new { message = "Only an ongoing trip can be ended." });
        var now = DateTimeOffset.UtcNow;
        trip.Status = TripStatus.Completed;
        trip.ActualArrivalUtc ??= now;
        trip.UpdatedAtUtc = now;
        var alerts = await db.SosEvents.Where(x => x.TripId == id && x.ResolvedAtUtc == null).ToListAsync(ct);
        foreach (var alert in alerts) alert.ResolvedAtUtc = now;
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "tripEnded", id }, ct);
        return NoContent();
    }

    [HttpDelete("trips/{id:guid}")]
    [Authorize(Roles = PortalRoles.Admin)]
    public async Task<IActionResult> DeleteTrip(Guid id, CancellationToken ct)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        var deleted = false;
        var result = await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var trip = await db.Trips.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (trip is null) return NotFound();

            if (trip.Status != TripStatus.Scheduled || trip.ActualDepartureUtc is not null ||
                trip.ActualArrivalUtc is not null)
                return Conflict(new { message = "Only a trip that has not started can be deleted." });

            if (trip.PassengerVerificationFinalizedAtUtc is not null)
                return Conflict(new { message = "This trip has passenger verification history and cannot be deleted." });

            var hasOperationalHistory = trip.PassengerCount != 0 || trip.ChildrenCount != 0 ||
                trip.SpecialNeedsCount != 0 ||
                await db.TripPassengers.AnyAsync(x => x.TripId == id, ct) ||
                await db.PassengerSessions.AnyAsync(x => x.TripId == id, ct) ||
                await db.WildlifeMonitoringRecords.AnyAsync(x => x.TripId == id, ct) ||
                await db.PassengerComplaints.AnyAsync(x => x.TripId == id, ct) ||
                await db.SosEvents.AnyAsync(x => x.TripId == id, ct) ||
                await db.TripTransfers.AnyAsync(x => x.SourceTripId == id || x.DestinationTripId == id, ct);
            if (hasOperationalHistory)
                return Conflict(new { message = "This trip has operational history and cannot be deleted." });

            db.Trips.Remove(trip);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            deleted = true;
            return NoContent();
        });

        if (deleted)
            await hub.Clients.All.SendAsync("operationsChanged", new { entity = "trip", id, deleted = true }, ct);
        return result;
    }

    [HttpPatch("trips/{id:guid}/status")]
    [Authorize(Roles = $"{PortalRoles.BoatOwner},{PortalRoles.BoatCrew},{PortalRoles.Ops},{PortalRoles.Admin}")]
    public async Task<ActionResult> UpdateStatus(Guid id, StatusRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<TripStatus>(request.Status, true, out var status) || !Enum.IsDefined(status))
            return ValidationProblem("Invalid status.");
        var trip = await db.Trips.Include(x => x.Boat).Include(x => x.CrewAssignments)
            .SingleOrDefaultAsync(x => x.Id == id, ct);
        if (trip is null) return NotFound();
        if (trip.Type == TripType.Patrol && !User.IsInRole(PortalRoles.Ops)) return Forbid();
        if (trip.Type != TripType.Patrol)
        {
            var canCancel = status == TripStatus.Cancelled &&
                ((User.IsInRole(PortalRoles.BoatOwner) && trip.Boat.OwnerId == UserId) ||
                 (User.IsInRole(PortalRoles.BoatCrew) && trip.CrewAssignments.Any(x => x.CrewUserId == UserId)) ||
                 User.IsInRole(PortalRoles.Admin) || User.IsInRole(PortalRoles.Ops));
            if (!canCancel)
                return Conflict(new { message = "Tourist trip lifecycle changes must use the dedicated start, decline, reschedule, and end actions." });
        }
        if (!CanTransitionTripStatus(trip.Status, status))
            return Conflict(new { message = $"Trip status cannot change from {trip.Status} to {status}." });
        if (trip.Status == status) return NoContent();
        var now = DateTimeOffset.UtcNow;
        trip.Status = status; trip.UpdatedAtUtc = now;
        if (status == TripStatus.Ongoing) trip.ActualDepartureUtc ??= now;
        if (status == TripStatus.Completed) trip.ActualArrivalUtc ??= now;
        if (status is TripStatus.Completed or TripStatus.Cancelled)
        {
            var activeSosAlerts = await db.SosEvents
                .Where(x => x.TripId == id && x.ResolvedAtUtc == null).ToListAsync(ct);
            foreach (var alert in activeSosAlerts) alert.ResolvedAtUtc = now;
        }
        await db.SaveChangesAsync(ct); await hub.Clients.All.SendAsync("operationsChanged", new { entity = "trip", id }, ct);
        return NoContent();
    }

    private static bool CanTransitionTripStatus(TripStatus current, TripStatus next) =>
        current == next || current switch
        {
            TripStatus.Scheduled => next is TripStatus.Boarding or TripStatus.Ongoing or TripStatus.Cancelled or TripStatus.NeedsReschedule or TripStatus.Declined,
            TripStatus.Boarding => next is TripStatus.Ongoing or TripStatus.Cancelled or TripStatus.NeedsReschedule or TripStatus.Declined,
            TripStatus.NeedsReschedule => next is TripStatus.Scheduled or TripStatus.Ongoing or TripStatus.Cancelled or TripStatus.Declined,
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

    private static BoatDocumentDto ToBoatDocumentDto(BoatDocument document) => new(
        document.Id, document.DocumentType, document.Name, document.FileName, document.ContentType,
        document.FileSize, document.UploadedAtUtc, document.ExpirationDate, document.Status.ToString(),
        document.Version, document.IsCurrent, document.ReplacesDocumentId, document.RejectionReason,
        document.VerifiedAtUtc, document.UploadedByUser?.DisplayName, document.VerifiedByUser?.DisplayName,
        BoatDocumentRequirements.RenewalState(document, DateOnly.FromDateTime(DateTime.UtcNow)));
}

public sealed record BoatDto(Guid Id, Guid OwnerId, string OwnerName, string Name, string RegistrationNumber,
    DateOnly RegistrationDate, string HullNumber, decimal LengthMeters, decimal WidthMeters,
    decimal MaximumSpeedKnots, int MaximumCapacity, int LifeJacketCount,
    string? GpsDeviceId, bool IsPatrolBoat, string Approval, string WildlifeApproval, string? ImageUrl,
    int DocumentRequirementsVersion, DateTimeOffset? RegistrationSubmittedAtUtc,
    IReadOnlyList<BoatDocumentDto> Documents);
public sealed record BoatDocumentDto(Guid Id, string DocumentType, string Name, string FileName,
    string ContentType, long FileSize, DateTimeOffset UploadedAtUtc, DateOnly? ExpirationDate,
    string Status, int Version, bool IsCurrent, Guid? ReplacesDocumentId, string? RejectionReason,
    DateTimeOffset? VerifiedAtUtc, string? UploadedBy, string? VerifiedBy, string RenewalState);
public sealed record TripDto(Guid Id, Guid BoatId, string VesselName, string RegistrationNumber, string OwnerName,
    DateTimeOffset ScheduledDepartureUtc, DateTimeOffset? ActualDepartureUtc, DateTimeOffset? ActualArrivalUtc,
    string Route, int PassengerCount, string Type, string Status, string? ShoreNotes,
    DateTimeOffset UpdatedAtUtc, string? InvitationCode, IReadOnlyList<TripCrewDto> Crew, bool HasActiveSos,
    DateTimeOffset? PassengerVerificationFinalizedAtUtc, Guid? StartedByUserId, string? StartedByRole,
    string? DeclineReason, Guid? DeclinedByUserId, DateTimeOffset? DeclinedAtUtc,
    bool RescheduleOverride, Guid? RescheduleOverrideByUserId, DateTimeOffset? RescheduleOverrideAtUtc,
    string? RescheduleOverrideReason);
public sealed record TripTrackingSummaryDto(Guid TripId, Guid BoatId, string Status, DateTimeOffset? StartedAtUtc,
    DateTimeOffset? EndedAtUtc, double? RouteLength, string RouteLengthUnit, long? MoveDurationSeconds,
    long? StopsDurationSeconds, decimal? AverageSpeed, string SpeedUnit, TripRoutePointDto? CurrentPosition,
    IReadOnlyList<TripRoutePointDto> Route, IReadOnlyList<TripStopDto> Stops);
public sealed record TripRoutePointDto(decimal Latitude, decimal Longitude, DateTimeOffset RecordedAtUtc,
    decimal? SpeedKnots, decimal? HeadingDegrees);
public sealed record TripStopDto(DateTimeOffset StartedAtUtc, DateTimeOffset? EndedAtUtc,
    long DurationSeconds, decimal Latitude, decimal Longitude, bool IsOngoing, decimal? SpeedKnots);
public sealed record BoatRouteHistoryDto(Guid BoatId, DateTimeOffset FromUtc, DateTimeOffset ToUtc,
    BoatRouteHistorySummaryDto Summary, TripRoutePointDto? LastKnownPosition,
    IReadOnlyList<BoatHistoricalTripDto> Trips, IReadOnlyList<BoatHistoricalRouteDto> UnassignedRoutes);
public sealed record BoatRouteHistorySummaryDto(double TotalDistance, string DistanceUnit, int TotalTrips,
    long MovingDurationSeconds, long StopsDurationSeconds, decimal? AverageSpeed, string SpeedUnit);
public sealed record BoatHistoricalTripDto(Guid TripId, string RouteName, string Status,
    DateTimeOffset StartedAtUtc, DateTimeOffset? EndedAtUtc, double? RouteLength,
    long? MoveDurationSeconds, long? StopsDurationSeconds, decimal? AverageSpeed,
    IReadOnlyList<TripRoutePointDto> Route, IReadOnlyList<TripStopDto> Stops);
public sealed record BoatHistoricalRouteDto(int SegmentNumber, DateTimeOffset StartedAtUtc,
    DateTimeOffset EndedAtUtc, double? RouteLength, long? MoveDurationSeconds,
    long? StopsDurationSeconds, decimal? AverageSpeed, IReadOnlyList<TripRoutePointDto> Route,
    IReadOnlyList<TripStopDto> Stops);
internal sealed record HistoricalTripRecord(Guid Id, string Route, DateTimeOffset StartedAtUtc,
    DateTimeOffset? EndedAtUtc, string Status);
public sealed record TripCrewDto(Guid CrewUserId, string Name, string Email, string Position,
    string? NicNumber, bool Certified);
public sealed record TripPassengerDto(Guid Id, string Name, string IdentificationNumber, string PhoneNumber,
    string AgeCategory, string PassengerType, string? CountryCode, string Gender,
    DateTimeOffset RegisteredAtUtc);
public sealed record SosAlertDto(Guid Id, Guid TripId, string VesselName, string RegistrationNumber,
    string Location, int PassengersOnboard, string NatureOfEmergency, DateTimeOffset RaisedAtUtc,
    bool HasActions);
public sealed record SosActionDto(Guid Id, Guid SosEventId, string TakenByName,
    string TakenByIdNumber, string Details, DateTimeOffset TakenAtUtc);
public sealed record SosActionRequest(
    [property: Required, StringLength(160, MinimumLength = 1)] string? ResponderName,
    [property: Required, StringLength(32, MinimumLength = 1)] string? ResponderIdNumber,
    [property: Required, StringLength(1000, MinimumLength = 1)] string? Details);
public sealed record CreateBoatRequest(
    [Required, StringLength(160, MinimumLength = 1)] string Name,
    [Required, StringLength(64, MinimumLength = 1)] string RegistrationNumber,
    DateOnly RegistrationDate,
    [Required, StringLength(64, MinimumLength = 1)] string HullNumber,
    [Range(typeof(decimal), "0.01", "100000")] decimal LengthMeters,
    [Range(typeof(decimal), "0.01", "100000")] decimal WidthMeters,
    [Range(1, 100000)] int MaximumCapacity,
    string? ImageUrl,
    [Range(typeof(decimal), "0", "9999.99")] decimal MaximumSpeedKnots = 0,
    [Range(0, 100000)] int LifeJacketCount = 0,
    [StringLength(128)] string? GpsDeviceId = null);
public sealed record CreateTripRequest(Guid BoatId, DateTimeOffset ScheduledDepartureUtc, string Route,
    int PassengerCount, IReadOnlyList<Guid> CrewUserIds, int ChildrenCount = 0, int SpecialNeedsCount = 0);
public sealed record UpdateTripCrewRequest([MinLength(1)] IReadOnlyList<Guid> CrewUserIds);
public sealed record RescheduleTripRequest(DateTimeOffset ScheduledDepartureUtc);
public sealed record StartTripRequest(bool ConfirmRescheduleOverride = false,
    [StringLength(1000)] string? OverrideReason = null);
public sealed record DeclineTripRequest([StringLength(1000)] string? Reason = null);
public sealed record StartPatrolRequest(Guid BoatId, [StringLength(300)] string? Route);
public sealed record StartPatrolResult(Guid Id, Guid BoatId, DateTimeOffset StartedAtUtc);
public sealed record ApprovalRequest(string Approval, string? Notes);
public sealed record ReviewBoatDocumentRequest(string Status, DateOnly? ExpirationDate,
    [StringLength(1000)] string? RejectionReason = null);
public sealed record StatusRequest(string Status);
public sealed record OperationsDirectoryDto(IReadOnlyList<DirectoryOwnerDto> Owners,
    IReadOnlyList<DirectoryCrewDto> Crew);
public sealed record DirectoryOwnerDto(Guid Id, string DisplayName, string Email, string? PhoneNumber,
    string? NicNumber, string? Bio);
public sealed record DirectoryCrewDto(Guid Id, string DisplayName, string Email, string? PhoneNumber,
    string Position, Guid? BoatId, Guid OwnerId, string? NicNumber, bool Certified);
public sealed record OwnerCrewDto(Guid AssignmentId, Guid CrewUserId, string Name, string Email,
    string? PhoneNumber, string Position, bool Certified, Guid? AssignedBoatId, string? AssignedBoatName);
public sealed record BoatCrewDto(Guid CrewUserId, string Name, string Email, string Position,
    bool Certified, DateTimeOffset AssignedAtUtc);
public sealed record AssignCrewBoatRequest(Guid? BoatId, [StringLength(100)] string? Position = null);
public sealed record CrewSuggestionDto(Guid CrewUserId, string Name, string Email, string Position);
public sealed record AddOwnerCrewRequest(string Email);
public sealed record VesselMapDto(Guid Id, string Name, string RegistrationNumber, string? ImageUrl, bool IsPatrolBoat, Guid? ActiveTripId,
    string CertificationApproval, string WildlifeApproval, string OperationalStatus,
    decimal? Latitude, decimal? Longitude, DateTimeOffset? CoordinatesRecordedAtUtc,
    DateTimeOffset? CoordinatesReceivedAtUtc, string TrackerStatus, decimal? HeadingDegrees,
    decimal? AltitudeMeters,
    DateTimeOffset? DepartureUtc, DateTimeOffset? ArrivalUtc, decimal LengthMeters, decimal BeamMeters,
    decimal? CruisingSpeedKnots, decimal MaximumSpeedKnots, int MaximumCapacity, int LifeJacketCount,
    int PassengerCount, int ChildrenCount, int SpecialNeedsCount, int LifeSaverCount, int DiverCount,
    int CoxswainCount);

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

namespace WhaleWatching.Api.Operations;

[ApiController]
[Route("api/operations/transfers")]
[Authorize]
public sealed class TripTransfersController(WhaleWatchingDbContext db, IHubContext<OperationsHub> hub) : ControllerBase
{
    private static readonly HashSet<string> Reasons = new(StringComparer.Ordinal)
    { "Boat mechanical issue", "Boat unavailable", "Operational issue", "Passenger redistribution",
      "Insufficient passengers", "Weather/operational adjustment", "Other" };

    [HttpGet("source/{sourceTripId:guid}")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult<TransferOptionsDto>> Options(Guid sourceTripId, CancellationToken ct)
    {
        var source = await db.Trips.AsNoTracking().Include(x => x.Boat).ThenInclude(x => x.Owner)
            .SingleOrDefaultAsync(x => x.Id == sourceTripId && x.Boat.OwnerId == UserId, ct);
        if (source is null) return NotFound();
        if (!Eligible(source.Status))
            return Conflict(new { message = "Only scheduled or boarding trips can be used as a transfer source." });
        var passengers = await db.TripPassengers.AsNoTracking().Where(x => x.TripId == sourceTripId)
            .OrderBy(x => x.Passenger.Name).Select(x => new TransferPassengerDto(x.PassengerId,
                x.Passenger.Name, x.Passenger.IdentificationNumber, x.Passenger.PhoneNumber)).ToListAsync(ct);
        var crew = await db.TripCrewAssignments.AsNoTracking().Where(x => x.TripId == sourceTripId)
            .OrderBy(x => x.CrewUser.DisplayName).Select(x => new TransferCrewDto(x.CrewUserId,
                x.CrewUser.DisplayName, x.CrewUser.Email!, x.CrewUser.CrewType ?? "Crew Member")).ToListAsync(ct);
        return Ok(new TransferOptionsDto(new TransferTripDto(source.Id, source.Boat.Name,
            source.Boat.RegistrationNumber, source.Boat.Owner.DisplayName, source.ScheduledDepartureUtc,
            passengers.Count, source.Boat.MaximumCapacity, crew.Count, source.Status.ToString()), passengers, crew));
    }

    [HttpGet("destination-boats")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult<IReadOnlyList<TransferBoatDto>>> SearchDestinationBoats(
        [FromQuery] Guid sourceTripId, [FromQuery] string? query, CancellationToken ct)
    {
        if (!await db.Trips.AnyAsync(x => x.Id == sourceTripId && x.Boat.OwnerId == UserId &&
                (x.Status == TripStatus.Scheduled || x.Status == TripStatus.Boarding), ct))
            return NotFound(new { message = "The source trip is not available for transfer." });
        var term = query?.Trim() ?? string.Empty;
        if (term.Length < 2) return Ok(Array.Empty<TransferBoatDto>());
        if (term.Length > 100) return BadRequest(new { message = "The boat search is too long." });
        var normalized = term.ToUpperInvariant();
        return Ok(await db.Boats.AsNoTracking().Where(x => x.Approval == ApprovalStatus.Approved &&
                (x.Name.ToUpper().Contains(normalized) || x.RegistrationNumber.ToUpper().Contains(normalized) ||
                 x.Id.ToString().Contains(term)))
            .OrderBy(x => x.Name).ThenBy(x => x.RegistrationNumber).Take(10)
            .Select(x => new TransferBoatDto(x.Id, x.Name, x.RegistrationNumber,
                x.Approval.ToString(), x.OwnerId, x.Owner.DisplayName)).ToListAsync(ct));
    }

    [HttpGet("destination-boats/{boatId:guid}/trips")]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult<IReadOnlyList<TransferTripDto>>> DestinationTrips(
        Guid boatId, [FromQuery] Guid sourceTripId, CancellationToken ct)
    {
        if (!await db.Trips.AnyAsync(x => x.Id == sourceTripId && x.Boat.OwnerId == UserId &&
                (x.Status == TripStatus.Scheduled || x.Status == TripStatus.Boarding), ct))
            return NotFound(new { message = "The source trip is not available for transfer." });
        var boatEligible = await db.Boats.AnyAsync(x => x.Id == boatId && x.Approval == ApprovalStatus.Approved, ct);
        if (!boatEligible) return NotFound(new { message = "The selected destination boat is not registered and approved." });
        return Ok(await db.Trips.AsNoTracking().Where(x => x.BoatId == boatId && x.Id != sourceTripId &&
                (x.Status == TripStatus.Scheduled || x.Status == TripStatus.Boarding))
            .OrderBy(x => x.ScheduledDepartureUtc).Select(x => new TransferTripDto(x.Id, x.Boat.Name,
                x.Boat.RegistrationNumber, x.Boat.Owner.DisplayName, x.ScheduledDepartureUtc,
                x.Passengers.Count, x.Boat.MaximumCapacity, x.CrewAssignments.Count,
                x.Status.ToString())).ToListAsync(ct));
    }

    [HttpPost]
    [Authorize(Policy = PortalPolicies.BoatOwner)]
    public async Task<ActionResult<TransferResultDto>> Transfer(TransferRequest request, CancellationToken ct)
    {
        if (request.ClientRequestId == Guid.Empty) return BadRequest(new { message = "A valid client request ID is required." });
        if (request.SourceTripId == request.DestinationTripId) return BadRequest(new { message = "Source and destination trips must be different." });
        if (request.PassengerIds.Count == 0 && request.CrewUserIds.Count == 0) return BadRequest(new { message = "Select at least one passenger or crew member." });
        if (request.PassengerIds.Count != request.PassengerIds.Distinct().Count() || request.CrewUserIds.Count != request.CrewUserIds.Distinct().Count())
            return BadRequest(new { message = "The transfer selection contains duplicate people." });
        if (!Reasons.Contains(request.Reason)) return BadRequest(new { message = "Select a valid transfer reason." });
        if (request.Reason == "Other" && string.IsNullOrWhiteSpace(request.Explanation)) return BadRequest(new { message = "Provide an explanation for the transfer." });

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<TransferResultDto>>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var duplicate = await db.TripTransfers.AsNoTracking().SingleOrDefaultAsync(x =>
                x.InitiatedByUserId == UserId && x.ClientRequestId == request.ClientRequestId, ct);
            if (duplicate is not null)
            {
                var existingCounts = await db.TripTransferItems.Where(x => x.TransferId == duplicate.Id)
                    .GroupBy(x => x.PersonType).Select(x => new { x.Key, Count = x.Count() }).ToListAsync(ct);
                return Ok(new TransferResultDto(duplicate.Id, duplicate.SourceTripId, duplicate.DestinationTripId,
                    existingCounts.FirstOrDefault(x => x.Key == "Passenger")?.Count ?? 0,
                    existingCounts.FirstOrDefault(x => x.Key == "Crew")?.Count ?? 0, duplicate.TransferredAtUtc));
            }

            var trips = await db.Trips.Include(x => x.Boat).Where(x =>
                x.Id == request.SourceTripId || x.Id == request.DestinationTripId).ToListAsync(ct);
            var source = trips.SingleOrDefault(x => x.Id == request.SourceTripId);
            var destination = trips.SingleOrDefault(x => x.Id == request.DestinationTripId);
            if (source is null || destination is null) return NotFound(new { message = "The source or destination trip no longer exists." });
            if (source.Boat.OwnerId != UserId) return Forbid();
            if (!Eligible(source.Status) || !Eligible(destination.Status)) return Conflict(new { message = "Both trips must still be scheduled or boarding." });
            if (destination.Boat.Approval != ApprovalStatus.Approved) return Conflict(new { message = "The destination boat is not registered and approved." });
            var sourcePassengerCount = await db.TripPassengers.CountAsync(x => x.TripId == source.Id, ct);
            var destinationPassengerCount = await db.TripPassengers.CountAsync(x => x.TripId == destination.Id, ct);
            if (destinationPassengerCount + request.PassengerIds.Count > destination.Boat.MaximumCapacity)
                return Conflict(new { message = $"This trip does not have enough passenger capacity. {request.PassengerIds.Count} passengers are selected for transfer, but only {Math.Max(0, destination.Boat.MaximumCapacity - destinationPassengerCount)} passenger spaces are available." });

            var passengerIds = request.PassengerIds.Distinct().ToArray();
            var passengerRows = await db.TripPassengers.Include(x => x.Passenger).Where(x =>
                x.TripId == source.Id && passengerIds.Contains(x.PassengerId)).ToListAsync(ct);
            if (passengerRows.Count != passengerIds.Length) return Conflict(new { message = "One or more selected passengers are no longer assigned to the source trip." });
            var duplicatePassenger = await db.TripPassengers.AnyAsync(x => passengerIds.Contains(x.PassengerId) &&
                x.TripId != source.Id && (x.Trip.Status == TripStatus.Scheduled || x.Trip.Status == TripStatus.Boarding || x.Trip.Status == TripStatus.Ongoing), ct);
            if (duplicatePassenger) return Conflict(new { message = "A selected passenger is already assigned to another active trip." });

            var crewIds = request.CrewUserIds.Distinct().ToArray();
            var crewRows = await db.TripCrewAssignments.Include(x => x.CrewUser).Where(x =>
                x.TripId == source.Id && crewIds.Contains(x.CrewUserId)).ToListAsync(ct);
            if (crewRows.Count != crewIds.Length) return Conflict(new { message = "One or more selected crew members are no longer assigned to the source trip." });
            var validCrew = await db.OwnerCrewMemberships.CountAsync(x => x.OwnerId == source.Boat.OwnerId &&
                crewIds.Contains(x.CrewUserId) && x.CrewUser.IsCrewCertified, ct);
            if (validCrew != crewIds.Length) return Conflict(new { message = "Every selected crew member must be certified and belong to the source boat owner's crew pool." });
            var duplicateCrew = await db.TripCrewAssignments.AnyAsync(x => crewIds.Contains(x.CrewUserId) &&
                x.TripId != source.Id && (x.Trip.Status == TripStatus.Scheduled || x.Trip.Status == TripStatus.Boarding || x.Trip.Status == TripStatus.Ongoing), ct);
            if (duplicateCrew) return Conflict(new { message = "A selected crew member is already assigned to another active trip." });

            foreach (var row in passengerRows) row.TripId = destination.Id;
            foreach (var row in crewRows) row.TripId = destination.Id;
            var sessions = await db.PassengerSessions.Where(x => x.TripId == source.Id && passengerIds.Contains(x.PassengerId)).ToListAsync(ct);
            foreach (var session in sessions) { session.TripId = destination.Id; session.ExpiresAtUtc = destination.ScheduledDepartureUtc.AddDays(1); }
            source.PassengerCount = Math.Max(0, sourcePassengerCount - passengerRows.Count);
            destination.PassengerCount = destinationPassengerCount + passengerRows.Count;
            var children = passengerRows.Count(x => string.Equals(x.Passenger.AgeCategory, "child", StringComparison.OrdinalIgnoreCase));
            source.ChildrenCount = Math.Max(0, source.ChildrenCount - children); destination.ChildrenCount += children;
            source.UpdatedAtUtc = destination.UpdatedAtUtc = DateTimeOffset.UtcNow;

            var transfer = new TripTransfer { Id = Guid.NewGuid(), ClientRequestId = request.ClientRequestId,
                SourceTripId = source.Id, DestinationTripId = destination.Id, InitiatedByUserId = UserId,
                Reason = request.Reason, Explanation = request.Explanation?.Trim(), Status = "Completed",
                TransferredAtUtc = DateTimeOffset.UtcNow };
            transfer.Items = passengerRows.Select(x => new TripTransferItem { Id = Guid.NewGuid(), PersonId = x.PassengerId,
                PersonType = "Passenger", PersonName = x.Passenger.Name }).Concat(crewRows.Select(x => new TripTransferItem {
                Id = Guid.NewGuid(), PersonId = x.CrewUserId, PersonType = "Crew", PersonName = x.CrewUser.DisplayName })).ToList();
            db.TripTransfers.Add(transfer);
            await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
            await hub.Clients.All.SendAsync("operationsChanged", new { entity = "transfer", id = transfer.Id,
                sourceTripId = source.Id, destinationTripId = destination.Id,
                destinationOwnerId = destination.Boat.OwnerId,
                crossOwner = source.Boat.OwnerId != destination.Boat.OwnerId }, ct);
            return Ok(new TransferResultDto(transfer.Id, source.Id, destination.Id,
                passengerRows.Count, crewRows.Count, transfer.TransferredAtUtc));
        });
    }

    [HttpGet("history")]
    [Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife},{PortalRoles.Ops},{PortalRoles.BoatOwner}")]
    public async Task<ActionResult<IReadOnlyList<TransferHistoryDto>>> History(CancellationToken ct)
    {
        var query = db.TripTransfers.AsNoTracking();
        if (User.IsInRole(PortalRoles.BoatOwner)) query = query.Where(x => x.InitiatedByUserId == UserId ||
            x.SourceTrip.Boat.OwnerId == UserId || x.DestinationTrip.Boat.OwnerId == UserId);
        return Ok(await query.OrderByDescending(x => x.TransferredAtUtc).Select(x => new TransferHistoryDto(x.Id,
            x.SourceTripId, x.SourceTrip.Boat.Name, x.SourceTrip.Boat.RegistrationNumber, x.SourceTrip.Boat.Owner.DisplayName,
            x.DestinationTripId, x.DestinationTrip.Boat.Name, x.DestinationTrip.Boat.RegistrationNumber, x.DestinationTrip.Boat.Owner.DisplayName,
            x.InitiatedByUser.DisplayName, x.Reason, x.Explanation, x.Status, x.TransferredAtUtc,
            x.Items.OrderBy(i => i.PersonType).ThenBy(i => i.PersonName)
                .Select(i => new TransferHistoryItemDto(i.PersonId, i.PersonType, i.PersonName)).ToList())).ToListAsync(ct));
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
    private static bool Eligible(TripStatus status) => status is TripStatus.Scheduled or TripStatus.Boarding;
}

public sealed class TransferRequest
{
    public Guid ClientRequestId { get; init; }
    public Guid SourceTripId { get; init; }
    public Guid DestinationTripId { get; init; }
    [MaxLength(500)] public IReadOnlyList<Guid> PassengerIds { get; init; } = [];
    [MaxLength(100)] public IReadOnlyList<Guid> CrewUserIds { get; init; } = [];
    [Required, MaxLength(100)] public required string Reason { get; init; }
    [MaxLength(1000)] public string? Explanation { get; init; }
}
public sealed record TransferBoatDto(Guid Id, string Name, string RegistrationNumber, string Status,
    Guid OwnerId, string OwnerName);
public sealed record TransferTripDto(Guid Id, string BoatName, string RegistrationNumber, string OwnerName,
    DateTimeOffset ScheduledDepartureUtc, int PassengerCount, int MaximumCapacity, int CrewCount, string Status);
public sealed record TransferPassengerDto(Guid Id, string Name, string IdentificationNumber, string PhoneNumber);
public sealed record TransferCrewDto(Guid Id, string Name, string Email, string Position);
public sealed record TransferOptionsDto(TransferTripDto Source, IReadOnlyList<TransferPassengerDto> Passengers,
    IReadOnlyList<TransferCrewDto> Crew);
public sealed record TransferResultDto(Guid TransferId, Guid SourceTripId, Guid DestinationTripId,
    int PassengerCount, int CrewCount, DateTimeOffset TransferredAtUtc);
public sealed record TransferHistoryItemDto(Guid PersonId, string PersonType, string PersonName);
public sealed record TransferHistoryDto(Guid Id, Guid SourceTripId, string SourceBoat, string SourceRegistrationNumber, string SourceOwner,
    Guid DestinationTripId, string DestinationBoat, string DestinationRegistrationNumber, string DestinationOwner, string InitiatedBy,
    string Reason, string? Explanation, string Status, DateTimeOffset TransferredAtUtc,
    IReadOnlyList<TransferHistoryItemDto> Items);

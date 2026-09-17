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
[Route("api/signature-requests")]
[Authorize(Roles = $"{PortalRoles.Supervisor},{PortalRoles.HarbourOfficer}")]
public sealed class SignatureRequestsController(
    WhaleWatchingDbContext db,
    IHubContext<OperationsHub> hub) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SignatureRequestDetailsDto>>> Mine(CancellationToken ct)
    {
        var requests = await RequestQuery().Where(x => x.RequestedUserId == UserId)
            .OrderByDescending(x => x.RequestedAtUtc).ToListAsync(ct);
        return Ok(requests.Select(ToDto).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SignatureRequestDetailsDto>> Get(Guid id, CancellationToken ct)
    {
        var request = await RequestQuery().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (request is null) return NotFound();
        if (request.RequestedUserId != UserId) return Forbid();
        return Ok(ToDto(request));
    }

    [HttpPost("{id:guid}/sign")]
    public async Task<ActionResult<SignatureRequestDetailsDto>> Sign(
        Guid id, SignSignatureRequest requestBody, CancellationToken ct)
    {
        var request = await RequestQuery(tracking: true).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (request is null) return NotFound();
        var hasRequiredRole = User.IsInRole(SignatureRequestRules.RequiredRole(request.SignatureType));
        if (request.RequestedUserId != UserId || !hasRequiredRole)
            return Forbid();
        if (!SignatureRequestRules.CanSign(request, UserId, hasRequiredRole))
            return Conflict(new { message = $"A {request.Status} signature request cannot be signed." });
        if (request.WildlifeMonitoringRecord.Status is WildlifeMonitoringStatus.Completed or WildlifeMonitoringStatus.Discarded)
            return Conflict(new { message = "The monitoring record is already closed." });
        if (!WildlifeMonitoringController.ValidSignature(requestBody.SignatureData))
            return ValidationProblem("A valid PNG signature is required.");

        var now = DateTimeOffset.UtcNow;
        request.Status = WildlifeSignatureRequestStatus.Signed;
        request.SignatureData = requestBody.SignatureData;
        request.SignedByName = request.RequestedUser.DisplayName;
        request.SignedAtUtc = now;
        request.UpdatedAtUtc = now;
        if (request.SignatureType == WildlifeSignatureType.Supervisor)
        {
            request.WildlifeMonitoringRecord.Supervisor = request.RequestedUser.DisplayName;
            request.WildlifeMonitoringRecord.SupervisorSignature = requestBody.SignatureData;
        }
        else
        {
            request.WildlifeMonitoringRecord.HarbourOfficerName = request.RequestedUser.DisplayName;
            request.WildlifeMonitoringRecord.HarbourOfficerSignature = requestBody.SignatureData;
        }
        request.WildlifeMonitoringRecord.UpdatedAtUtc = now;
        var otherType = request.SignatureType == WildlifeSignatureType.Supervisor
            ? WildlifeSignatureType.HarbourOfficer : WildlifeSignatureType.Supervisor;
        var otherSigned = request.WildlifeMonitoringRecord.SignatureRequests.Any(x =>
            x.SignatureType == otherType && x.Status == WildlifeSignatureRequestStatus.Signed);
        if (otherSigned && request.WildlifeMonitoringRecord.MonitoringOfficerSignature is not null)
            request.WildlifeMonitoringRecord.SignedAtUtc = now;

        await db.SaveChangesAsync(ct);
        await NotifyChanged(request, ct);
        return Ok(ToDto(request));
    }

    [HttpPost("{id:guid}/decline")]
    public async Task<ActionResult<SignatureRequestDetailsDto>> Decline(
        Guid id, DeclineSignatureRequest requestBody, CancellationToken ct)
    {
        var request = await RequestQuery(tracking: true).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (request is null) return NotFound();
        var hasRequiredRole = User.IsInRole(SignatureRequestRules.RequiredRole(request.SignatureType));
        if (request.RequestedUserId != UserId || !hasRequiredRole)
            return Forbid();
        if (!SignatureRequestRules.CanSign(request, UserId, hasRequiredRole))
            return Conflict(new { message = $"A {request.Status} signature request cannot be declined." });
        if (request.WildlifeMonitoringRecord.Status is WildlifeMonitoringStatus.Completed or WildlifeMonitoringStatus.Discarded)
            return Conflict(new { message = "The monitoring record is already closed." });
        var now = DateTimeOffset.UtcNow;
        request.Status = WildlifeSignatureRequestStatus.Declined;
        request.DeclineReason = requestBody.Reason?.Trim();
        request.DeclinedAtUtc = now;
        request.UpdatedAtUtc = now;
        request.WildlifeMonitoringRecord.UpdatedAtUtc = now;
        await db.SaveChangesAsync(ct);
        await NotifyChanged(request, ct);
        return Ok(ToDto(request));
    }

    private IQueryable<WildlifeSignatureRequest> RequestQuery(bool tracking = false)
    {
        IQueryable<WildlifeSignatureRequest> query = db.WildlifeSignatureRequests
            .Include(x => x.RequestedUser)
            .Include(x => x.RequestedByUser)
            .Include(x => x.WildlifeMonitoringRecord).ThenInclude(x => x.Trip).ThenInclude(x => x.Boat);
        if (tracking)
            query = query.Include(x => x.WildlifeMonitoringRecord).ThenInclude(x => x.SignatureRequests);
        return tracking ? query : query.AsNoTracking();
    }

    private async Task NotifyChanged(WildlifeSignatureRequest request, CancellationToken ct)
    {
        var payload = new { request.Id, request.WildlifeMonitoringRecordId,
            request.WildlifeMonitoringRecord.TripId, status = request.Status.ToString() };
        await hub.Clients.Group($"role:{PortalRoles.ShoreWildlife}")
            .SendAsync("wildlifeRecordChanged", payload, ct);
        await hub.Clients.Group($"user:{request.RequestedUserId}")
            .SendAsync("signatureRequestChanged", payload, ct);
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ??
        User.FindFirstValue("sub")!);

    private static SignatureRequestDetailsDto ToDto(WildlifeSignatureRequest request) => new(
        request.Id, request.WildlifeMonitoringRecordId, request.WildlifeMonitoringRecord.TicketNumber,
        request.WildlifeMonitoringRecord.TripId, request.WildlifeMonitoringRecord.Trip.Boat.Name,
        request.WildlifeMonitoringRecord.Trip.Boat.RegistrationNumber,
        request.WildlifeMonitoringRecord.Trip.ScheduledDepartureUtc,
        request.WildlifeMonitoringRecord.MonitoringOfficer, request.RequestedByUser.DisplayName,
        request.RequestedAtUtc, request.SignatureType.ToString(), request.Status.ToString(),
        request.SignedAtUtc, request.DeclinedAtUtc, request.DeclineReason, request.SignatureData);
}

public sealed record SignSignatureRequest([param: Required] string SignatureData);
public sealed record DeclineSignatureRequest([param: MaxLength(1000)] string? Reason);
public sealed record SignatureRequestDetailsDto(Guid Id, Guid WildlifeMonitoringRecordId,
    string AttendanceReference, Guid TripId, string BoatName, string RegistrationNumber,
    DateTimeOffset TripDateUtc, string MonitoringOfficer, string RequestedByName,
    DateTimeOffset RequestedAtUtc, string SignatureType, string Status,
    DateTimeOffset? SignedAtUtc, DateTimeOffset? DeclinedAtUtc, string? DeclineReason,
    string? SignatureData);

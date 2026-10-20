using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Complaints;

namespace WhaleWatching.Api.Passenger;

[ApiController]
[Route("api/complaints")]
public sealed class ComplaintsController(WhaleWatchingDbContext db, ComplaintAccess access, ComplaintWorkflow workflow) : ControllerBase
{
    private static readonly HashSet<string> AllowedTypes = new(StringComparer.Ordinal)
    {
        "Safety concern", "Crew conduct", "Boat condition", "Service quality",
        "Booking or payment", "Environmental violation", "Other"
    };

    [HttpPost]
    [AllowAnonymous]
    [RequestSizeLimit(5_250_000)]
    public async Task<ActionResult> Create([FromForm] CreateComplaintRequest request, CancellationToken ct)
    {
        if (!AllowedTypes.Contains(request.Type))
            return BadRequest(new { message = "Select a valid complaint type." });
        if (request.Kind is not ("Complaint" or "Inquiry") || string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { message = "Supply a valid record kind and message." });
        if (request.RequestId == Guid.Empty) return BadRequest(new { message = "Supply a valid submission request ID." });

        var rawToken = Request.Headers["X-Passenger-Session"].ToString();
        if (string.IsNullOrWhiteSpace(rawToken)) return Unauthorized();
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
        var session = await db.PassengerSessions.AsNoTracking()
            .SingleOrDefaultAsync(x => x.TokenHash == tokenHash && x.ExpiresAtUtc > DateTimeOffset.UtcNow, ct);
        if (session is null) return Unauthorized(new { message = "Your passenger session has expired. Please scan the trip QR code again." });

        ComplaintImage? image = null;
        if (request.Evidence is not null)
        {
            if (request.Evidence.Length == 0 || request.Evidence.Length > 5_000_000)
                return BadRequest(new { message = "The attached image must be smaller than 5 MB." });
            if (!request.Evidence.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Only image evidence can be attached." });
            await using var memory = new MemoryStream();
            await request.Evidence.CopyToAsync(memory, ct);
            image = new ComplaintImage { Id = Guid.NewGuid(), FileName = Path.GetFileName(request.Evidence.FileName), ContentType = request.Evidence.ContentType, Content = memory.ToArray() };
        }

        var complaintId = request.RequestId ?? Guid.NewGuid();
        async Task<ActionResult?> ReplayAsync()
        {
            var prior = await db.PassengerComplaints.AsNoTracking().Include(x => x.Images).SingleOrDefaultAsync(x => x.Id == complaintId, ct);
            if (prior is null) return null;
            var sameEvidence = image is null ? prior.Images.Count == 0 : prior.Images.Count == 1 && prior.Images.Any(i =>
                i.FileName == image.FileName && i.ContentType == image.ContentType && i.Content.AsSpan().SequenceEqual(image.Content));
            return prior.PassengerId == session.PassengerId && prior.TripId == session.TripId &&
                prior.Kind == request.Kind && prior.Type == request.Type && prior.Message == request.Message.Trim() && sameEvidence
                ? Ok(new { prior.Id }) : Conflict(new { message = "This submission request ID was already used. Start a new submission." });
        }
        if (request.RequestId is not null && await ReplayAsync() is { } replay) return replay;
        var complaint = new PassengerComplaint
        {
            Id = complaintId, PassengerId = session.PassengerId, TripId = session.TripId,
            Type = request.Type, Kind = request.Kind, Message = request.Message.Trim(), CreatedAtUtc = DateTimeOffset.UtcNow
        };
        if (image is not null) complaint.Images.Add(image);
        db.PassengerComplaints.Add(complaint);
        await workflow.RecordSubmissionAsync(complaint, ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (request.RequestId is not null && ex.InnerException is SqlException { Number: 2601 or 2627 })
        {
            // A concurrent retry lost the unique complaint-ID race. SaveChanges rolled back the whole event/notification batch.
            db.ChangeTracker.Clear();
            return await ReplayAsync() ?? Conflict(new { message = "Please retry the submission." });
        }
        await workflow.PublishAsync(await access.EligibleUsersAsync(ComplaintAccess.MonitorRoles, ct), ct);
        return Created($"/api/complaints/{complaint.Id}", new { complaint.Id });
    }

    [HttpGet]
    [Authorize(Policy = PortalPolicies.PassengerMonitoring)]
    public async Task<ActionResult<IReadOnlyList<ComplaintDto>>> List(CancellationToken ct)
    {
        var actor = await access.ActorAsync(User, ct);
        if (actor is not { Monitor: true }) return Forbid();
        var entities = await db.PassengerComplaints.AsNoTracking()
            .Include(x => x.Passenger).Include(x => x.Trip).ThenInclude(x => x.Boat).ThenInclude(x => x.Owner)
            .Include(x => x.Images)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(100)
            .ToListAsync(ct);
        var complaints = entities.Select(x => new ComplaintDto(x.Id, x.Passenger.Name, x.Passenger.PhoneNumber,
                x.Trip.Boat.Id, x.Trip.Boat.Name, x.Trip.Boat.RegistrationNumber,
                x.Trip.Boat.Owner.DisplayName, x.Type, x.Message, x.CreatedAtUtc,
                x.Images.Select(i => $"data:{i.ContentType};base64,{Convert.ToBase64String(i.Content)}").ToArray()))
            .ToList();
        return Ok(complaints);
    }
}

public sealed class CreateComplaintRequest
{
    public Guid? RequestId { get; init; }
    [MaxLength(16)] public string Kind { get; init; } = "Complaint";
    [Required, MaxLength(64)] public required string Type { get; init; }
    [Required, MaxLength(2000)] public required string Message { get; init; }
    public IFormFile? Evidence { get; init; }
}

public sealed record ComplaintDto(Guid Id, string PassengerName, string Contact, Guid BoatId,
    string BoatName, string RegistrationNumber, string OwnerName, string Type, string Message,
    DateTimeOffset CreatedAt, IReadOnlyList<string> Images);

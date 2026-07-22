using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Passenger;

[ApiController]
[Route("api/complaints")]
public sealed class ComplaintsController(WhaleWatchingDbContext db) : ControllerBase
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

        var complaint = new PassengerComplaint
        {
            Id = Guid.NewGuid(), PassengerId = session.PassengerId, TripId = session.TripId,
            Type = request.Type, Message = request.Message.Trim(), CreatedAtUtc = DateTimeOffset.UtcNow
        };
        if (image is not null) complaint.Images.Add(image);
        db.PassengerComplaints.Add(complaint);
        await db.SaveChangesAsync(ct);
        return Created($"/api/complaints/{complaint.Id}", new { complaint.Id });
    }

    [HttpGet]
    [Authorize(Roles = PortalRoles.Admin + "," + PortalRoles.Wildlife)]
    public async Task<ActionResult<IReadOnlyList<ComplaintDto>>> List(CancellationToken ct)
    {
        var entities = await db.PassengerComplaints.AsNoTracking()
            .Include(x => x.Passenger).Include(x => x.Trip).ThenInclude(x => x.Boat).ThenInclude(x => x.Owner)
            .Include(x => x.Images)
            .OrderByDescending(x => x.CreatedAtUtc)
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
    [Required, MaxLength(64)] public required string Type { get; init; }
    [Required, MaxLength(2000)] public required string Message { get; init; }
    public IFormFile? Evidence { get; init; }
}

public sealed record ComplaintDto(Guid Id, string PassengerName, string Contact, Guid BoatId,
    string BoatName, string RegistrationNumber, string OwnerName, string Type, string Message,
    DateTimeOffset CreatedAt, IReadOnlyList<string> Images);

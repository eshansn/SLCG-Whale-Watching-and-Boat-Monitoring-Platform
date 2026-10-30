using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Profiles;

namespace WhaleWatching.Api.Admin;

[ApiController]
[Route("api/admin/crew")]
[Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife}")]
public sealed class CrewController(WhaleWatchingDbContext db) : ControllerBase
{
    [HttpGet("{id:guid}/certificates")]
    public async Task<IActionResult> Certificates(Guid id, CancellationToken ct) =>
        Ok(await db.CrewCertificates.AsNoTracking().Where(x => x.CrewUserId == id)
            .OrderByDescending(x => x.UploadedAtUtc)
            .Select(x => new WhaleWatching.Api.Profiles.CrewCertificateDto(x.Id, x.Name, x.ContentType, x.UploadedAtUtc)).ToListAsync(ct));

    [HttpGet("{id:guid}/certificates/{certificateId:guid}")]
    public async Task<IActionResult> DownloadCertificate(Guid id, Guid certificateId, CancellationToken ct)
    {
        var document = await db.CrewCertificates.AsNoTracking()
            .SingleOrDefaultAsync(x => x.CrewUserId == id && x.Id == certificateId, ct);
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers.CacheControl = "no-store";
        return document?.Content is not { Length: > 0 } ? NotFound() : File(document.Content, document.ContentType, document.Name);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AdminCrewDto>>> List(CancellationToken ct)
    {
        var crew = await db.Users.AsNoTracking()
            .Where(user => db.UserRoles.Any(userRole => userRole.UserId == user.Id &&
                db.Roles.Any(role => role.Id == userRole.RoleId && role.Name == PortalRoles.BoatCrew)))
            .OrderBy(user => user.DisplayName)
            .Select(user => new AdminCrewDto(
                user.Id,
                user.DisplayName,
                user.Email!,
                user.PhoneNumber,
                user.CrewType ?? "Crew Member",
                user.NicNumber,
                user.Bio,
                user.IsCrewCertified,
                db.OwnerCrewMemberships.Where(membership => membership.CrewUserId == user.Id)
                    .OrderBy(membership => membership.AddedAtUtc)
                    .Select(membership => (Guid?)membership.OwnerId)
                    .FirstOrDefault(),
                db.CrewAssignments.Where(assignment => assignment.CrewUserId == user.Id && assignment.IsActive)
                    .OrderBy(assignment => assignment.Boat.Name)
                    .Select(assignment => (Guid?)assignment.BoatId)
                    .FirstOrDefault()))
            .ToListAsync(ct);

        var statuses = await CrewCertificateValidation.StatusesAsync(db, crew.Select(c => c.Id).ToArray(), ct);
        return Ok(crew.Select(c => c with { Certificate = statuses[c.Id] }).ToList());
    }
}

public sealed record AdminCrewDto(Guid Id, string DisplayName, string Email, string? PhoneNumber,
    string Position, string? NicNumber, string? Bio, bool Certified, Guid? OwnerId, Guid? BoatId)
{
    public CrewCertificateStatus Certificate { get; init; } = CrewCertificateValidation.Missing;
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;

namespace WhaleWatching.Api.Admin;

[ApiController]
[Route("api/admin/crew")]
[Authorize(Roles = PortalRoles.Admin)]
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
        return document is null ? NotFound() : File(document.Content, document.ContentType, document.Name);
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

        return Ok(crew);
    }
}

public sealed record AdminCrewDto(Guid Id, string DisplayName, string Email, string? PhoneNumber,
    string Position, string? NicNumber, string? Bio, bool Certified, Guid? OwnerId, Guid? BoatId);

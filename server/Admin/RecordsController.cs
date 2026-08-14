using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Realtime;

namespace WhaleWatching.Api.Admin;

[ApiController]
[Route("api/admin/records")]
[Authorize(Roles = PortalRoles.Admin)]
public sealed class RecordsController(
    WhaleWatchingDbContext db,
    UserManager<ApplicationUser> users,
    IHubContext<OperationsHub> hub) : ControllerBase
{
    [HttpPatch("boats/{id:guid}")]
    public async Task<IActionResult> UpdateBoat(Guid id, UpdateAdminBoatRequest request, CancellationToken ct)
    {
        var boat = await db.Boats.SingleOrDefaultAsync(item => item.Id == id, ct);
        if (boat is null) return NotFound();

        var ownerExists = await IsInRoleAsync(request.OwnerId, PortalRoles.BoatOwner, ct);
        if (!ownerExists) return ValidationProblem("The selected boat owner does not exist.");
        if (boat.OwnerId != request.OwnerId &&
            await db.Trips.AnyAsync(trip => trip.BoatId == id && trip.Status == TripStatus.Ongoing, ct))
            return Conflict(new { message = "A boat with an ongoing trip cannot be reassigned to another owner." });

        var registrationNumber = request.RegistrationNumber.Trim();
        if (await db.Boats.AnyAsync(item => item.Id != id && item.RegistrationNumber == registrationNumber, ct))
            return Conflict(new { message = "That boat registration number is already in use." });

        if (boat.OwnerId != request.OwnerId)
        {
            var activeCrewIds = await db.CrewAssignments
                .Where(assignment => assignment.BoatId == id && assignment.IsActive)
                .Select(assignment => assignment.CrewUserId)
                .ToArrayAsync(ct);
            var existingMembershipIds = await db.OwnerCrewMemberships
                .Where(membership => membership.OwnerId == request.OwnerId && activeCrewIds.Contains(membership.CrewUserId))
                .Select(membership => membership.CrewUserId)
                .ToArrayAsync(ct);
            db.OwnerCrewMemberships.AddRange(activeCrewIds.Except(existingMembershipIds).Select(crewUserId =>
                new OwnerCrewMembership
                {
                    Id = Guid.NewGuid(),
                    OwnerId = request.OwnerId,
                    CrewUserId = crewUserId,
                    AddedAtUtc = DateTimeOffset.UtcNow,
                }));
        }

        boat.OwnerId = request.OwnerId;
        boat.Name = request.Name.Trim();
        boat.RegistrationNumber = registrationNumber;
        boat.RegistrationDate = request.RegistrationDate;
        boat.HullNumber = request.HullNumber.Trim();
        boat.LengthMeters = request.LengthMeters;
        boat.WidthMeters = request.WidthMeters;
        boat.MaximumCapacity = request.MaximumCapacity;

        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "boat", id }, ct);
        return NoContent();
    }

    [HttpPatch("owners/{id:guid}")]
    public async Task<IActionResult> UpdateOwner(Guid id, UpdateAdminOwnerRequest request, CancellationToken ct)
    {
        var owner = await FindRoleUserAsync(id, PortalRoles.BoatOwner, ct);
        if (owner is null) return NotFound();

        var conflict = await ValidateUniqueIdentityAsync(id, request.Email, request.Nic, ct);
        if (conflict is not null) return Conflict(new { message = conflict });

        ApplyIdentity(owner, request.Name, request.Nic, request.Email, request.Phone, request.Address);
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "owner", id }, ct);
        return NoContent();
    }

    [HttpPatch("crew/{id:guid}")]
    public async Task<IActionResult> UpdateCrew(Guid id, UpdateAdminCrewRequest request, CancellationToken ct)
    {
        var crew = await FindRoleUserAsync(id, PortalRoles.BoatCrew, ct);
        if (crew is null) return NotFound();

        var conflict = await ValidateUniqueIdentityAsync(id, request.Email, request.Nic, ct);
        if (conflict is not null) return Conflict(new { message = conflict });

        Boat? selectedBoat = null;
        if (request.BoatId is not null)
        {
            selectedBoat = await db.Boats.SingleOrDefaultAsync(boat => boat.Id == request.BoatId, ct);
            if (selectedBoat is null) return ValidationProblem("The selected boat does not exist.");
        }

        ApplyIdentity(crew, request.Name, request.Nic, request.Email, request.Phone, request.Address);
        crew.CrewType = request.Role.Trim();

        var assignments = await db.CrewAssignments.Where(assignment => assignment.CrewUserId == id).ToListAsync(ct);
        foreach (var assignment in assignments) assignment.IsActive = false;
        if (selectedBoat is not null)
        {
            var assignment = assignments.FirstOrDefault(item => item.BoatId == selectedBoat.Id);
            if (assignment is null)
            {
                db.CrewAssignments.Add(new CrewAssignment
                {
                    Id = Guid.NewGuid(),
                    BoatId = selectedBoat.Id,
                    CrewUserId = id,
                    Position = crew.CrewType,
                    IsActive = true,
                });
            }
            else
            {
                assignment.Position = crew.CrewType;
                assignment.IsActive = true;
            }

            var memberships = await db.OwnerCrewMemberships
                .Where(membership => membership.CrewUserId == id)
                .ToListAsync(ct);
            db.OwnerCrewMemberships.RemoveRange(memberships.Where(membership => membership.OwnerId != selectedBoat.OwnerId));
            if (!memberships.Any(membership => membership.OwnerId == selectedBoat.OwnerId))
            {
                db.OwnerCrewMemberships.Add(new OwnerCrewMembership
                {
                    Id = Guid.NewGuid(),
                    OwnerId = selectedBoat.OwnerId,
                    CrewUserId = id,
                    AddedAtUtc = DateTimeOffset.UtcNow,
                });
            }
        }

        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "crew", id }, ct);
        return NoContent();
    }

    [HttpDelete("owners/{id:guid}")]
    public async Task<IActionResult> DeleteOwner(Guid id, CancellationToken ct)
    {
        var owner = await FindRoleUserAsync(id, PortalRoles.BoatOwner, ct);
        if (owner is null) return NotFound();
        if (await db.Boats.AnyAsync(boat => boat.OwnerId == id, ct))
            return Conflict(new { message = "This owner cannot be deleted while active boats are registered to the account." });

        db.OwnerCrewMemberships.RemoveRange(await db.OwnerCrewMemberships
            .Where(membership => membership.OwnerId == id).ToListAsync(ct));
        await ArchiveRoleAsync(owner, PortalRoles.BoatOwner, ct);
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "owner", id, deleted = true }, ct);
        return NoContent();
    }

    [HttpDelete("crew/{id:guid}")]
    public async Task<IActionResult> DeleteCrew(Guid id, CancellationToken ct)
    {
        var crew = await FindRoleUserAsync(id, PortalRoles.BoatCrew, ct);
        if (crew is null) return NotFound();
        if (await db.TripCrewAssignments.AnyAsync(assignment => assignment.CrewUserId == id &&
                assignment.Trip.Status == TripStatus.Ongoing, ct))
            return Conflict(new { message = "A crew member assigned to an ongoing trip cannot be deleted." });

        var assignments = await db.CrewAssignments.Where(assignment => assignment.CrewUserId == id).ToListAsync(ct);
        foreach (var assignment in assignments) assignment.IsActive = false;
        db.OwnerCrewMemberships.RemoveRange(await db.OwnerCrewMemberships
            .Where(membership => membership.CrewUserId == id).ToListAsync(ct));
        db.TripCrewAssignments.RemoveRange(await db.TripCrewAssignments
            .Where(assignment => assignment.CrewUserId == id &&
                (assignment.Trip.Status == TripStatus.Scheduled || assignment.Trip.Status == TripStatus.Boarding))
            .ToListAsync(ct));
        crew.IsCrewCertified = false;
        await ArchiveRoleAsync(crew, PortalRoles.BoatCrew, ct);
        await db.SaveChangesAsync(ct);
        await hub.Clients.All.SendAsync("operationsChanged", new { entity = "crew", id, deleted = true }, ct);
        return NoContent();
    }

    private async Task<bool> IsInRoleAsync(Guid userId, string role, CancellationToken ct) =>
        await db.UserRoles.AnyAsync(userRole => userRole.UserId == userId &&
            db.Roles.Any(identityRole => identityRole.Id == userRole.RoleId && identityRole.Name == role), ct);

    private async Task<ApplicationUser?> FindRoleUserAsync(Guid id, string role, CancellationToken ct) =>
        await db.Users.SingleOrDefaultAsync(user => user.Id == id &&
            db.UserRoles.Any(userRole => userRole.UserId == user.Id &&
                db.Roles.Any(identityRole => identityRole.Id == userRole.RoleId && identityRole.Name == role)), ct);

    private async Task<string?> ValidateUniqueIdentityAsync(Guid id, string emailValue, string nicValue, CancellationToken ct)
    {
        var normalizedEmail = users.NormalizeEmail(emailValue.Trim());
        var normalizedNic = nicValue.Trim().ToUpperInvariant();
        if (await db.Users.AnyAsync(user => user.Id != id && user.NormalizedEmail == normalizedEmail, ct))
            return "That email address is already in use.";
        if (await db.Users.AnyAsync(user => user.Id != id && user.NicNumber == normalizedNic, ct))
            return "That NIC number is already in use.";
        return null;
    }

    private void ApplyIdentity(ApplicationUser user, string name, string nic, string email, string phone, string? address)
    {
        user.DisplayName = name.Trim();
        user.NicNumber = nic.Trim().ToUpperInvariant();
        user.Email = email.Trim();
        user.NormalizedEmail = users.NormalizeEmail(user.Email);
        user.PhoneNumber = phone.Trim();
        user.Bio = address?.Trim();
    }

    private async Task ArchiveRoleAsync(ApplicationUser user, string roleName, CancellationToken ct)
    {
        var roleId = await db.Roles.Where(role => role.Name == roleName).Select(role => role.Id).SingleAsync(ct);
        var userRole = await db.UserRoles.SingleAsync(item => item.UserId == user.Id && item.RoleId == roleId, ct);
        db.UserRoles.Remove(userRole);
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        if (!await db.UserRoles.AnyAsync(item => item.UserId == user.Id && item.RoleId != roleId, ct))
        {
            user.LockoutEnabled = true;
            user.LockoutEnd = DateTimeOffset.MaxValue;
        }
    }
}

public sealed record UpdateAdminBoatRequest(
    Guid OwnerId,
    [property: Required, StringLength(160, MinimumLength = 1)] string Name,
    [property: Required, StringLength(64, MinimumLength = 1)] string RegistrationNumber,
    DateOnly RegistrationDate,
    [property: Required, StringLength(64, MinimumLength = 1)] string HullNumber,
    [property: Range(typeof(decimal), "0.01", "100000")] decimal LengthMeters,
    [property: Range(typeof(decimal), "0.01", "100000")] decimal WidthMeters,
    [property: Range(1, 100000)] int MaximumCapacity);

public sealed record UpdateAdminOwnerRequest(
    [property: Required, StringLength(160, MinimumLength = 1)] string Name,
    [property: Required, StringLength(20, MinimumLength = 1)] string Nic,
    [property: Required, EmailAddress] string Email,
    [property: Required, StringLength(32, MinimumLength = 1)] string Phone,
    [property: StringLength(1000)] string? Address);

public sealed record UpdateAdminCrewRequest(
    [property: Required, StringLength(160, MinimumLength = 1)] string Name,
    [property: Required, StringLength(20, MinimumLength = 1)] string Nic,
    [property: Required, EmailAddress] string Email,
    [property: Required, StringLength(32, MinimumLength = 1)] string Phone,
    [property: StringLength(1000)] string? Address,
    [property: Required, StringLength(100, MinimumLength = 1)] string Role,
    Guid? BoatId);

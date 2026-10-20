using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Complaints;

public sealed record ComplaintActor(Guid Id, string Name, bool Monitor, Guid[] AuthorityRoleIds);

public sealed class ComplaintAccess(WhaleWatchingDbContext db)
{
    public static readonly string[] MonitorRoles = [PortalRoles.Admin, PortalRoles.Sltda];
    public static readonly string[] AuthorityRoles = [PortalRoles.Ops, PortalRoles.Admin,
        PortalRoles.Wildlife, PortalRoles.Sltda, PortalRoles.HarbourOfficer];
    public static readonly string[] AllRoles = [.. AuthorityRoles];

    public async Task<ComplaintActor?> ActorAsync(ClaimsPrincipal principal, CancellationToken ct)
    {
        if (principal.Identity?.IsAuthenticated != true || !Guid.TryParse(
                principal.FindFirstValue("sub") ?? principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return null;
        var now = DateTimeOffset.UtcNow;
        var user = await db.Users.AsNoTracking().Where(x => x.Id == id && x.EmailConfirmed &&
            (x.LockoutEnd == null || x.LockoutEnd <= now)).Select(x => new { x.Id, x.DisplayName }).SingleOrDefaultAsync(ct);
        if (user is null) return null;
        // Current database membership prevents stale JWT roles from retaining complaint access.
        var roles = await (from membership in db.UserRoles join role in db.Roles on membership.RoleId equals role.Id
            where membership.UserId == id select new { role.Id, role.Name }).ToListAsync(ct);
        if (!roles.Any(x => AllRoles.Contains(x.Name!))) return null;
        return new(id, user.DisplayName, roles.Any(x => MonitorRoles.Contains(x.Name!)),
            roles.Where(x => AuthorityRoles.Contains(x.Name!)).Select(x => x.Id).ToArray());
    }

    public IQueryable<PassengerComplaint> VisibleComplaints(ComplaintActor actor) =>
        actor.Monitor ? db.PassengerComplaints : db.PassengerComplaints.Where(x => x.Assignments.Any(a => actor.AuthorityRoleIds.Contains(a.AuthorityRoleId)));

    public IQueryable<ComplaintNotification> VisibleNotifications(ComplaintActor actor) =>
        db.ComplaintNotifications.Where(x => x.RecipientUserId == actor.Id &&
            (actor.Monitor || (x.Event.AssignmentId != null && actor.AuthorityRoleIds.Contains(x.Event.Assignment!.AuthorityRoleId))));

    public Task<List<Guid>> EligibleUsersAsync(string[] roleNames, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        return (from member in db.UserRoles join role in db.Roles on member.RoleId equals role.Id
            join user in db.Users on member.UserId equals user.Id
            where roleNames.Contains(role.Name!) && user.EmailConfirmed && (user.LockoutEnd == null || user.LockoutEnd <= now)
            select user.Id).Distinct().ToListAsync(ct);
    }
}

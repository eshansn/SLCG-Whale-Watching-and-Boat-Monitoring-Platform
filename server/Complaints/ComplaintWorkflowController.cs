using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Complaints;

[ApiController]
[Route("api/complaint-workflow")]
[Authorize(Policy = PortalPolicies.ComplaintAccess)]
public sealed class ComplaintWorkflowController(WhaleWatchingDbContext db, ComplaintAccess access, ComplaintWorkflow workflow) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> List([FromQuery] ComplaintQuery query, CancellationToken ct)
    {
        var actor = await access.ActorAsync(User, ct);
        if (actor is null) return Forbid();
        if (query.From > query.To) return BadRequest(new { message = "The end date must follow the start date." });
        var records = access.VisibleComplaints(actor).AsNoTracking().IgnoreQueryFilters();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            var parsed = Guid.TryParse(search.Replace("WWMS-", "", StringComparison.OrdinalIgnoreCase), out var id);
            records = records.Where(x => x.Passenger.Name.Contains(search) || x.Type.Contains(search) || x.Message.Contains(search) || (parsed && x.Id == id));
        }
        if (query.PassengerId is { } passengerId) records = records.Where(x => x.PassengerId == passengerId);
        if (!string.IsNullOrEmpty(query.Status))
        {
            if (!Enum.TryParse<ComplaintStatus>(query.Status, out var status) || !Enum.IsDefined(status)) return BadRequest(new { message = "Invalid complaint status." });
            records = records.Where(x => x.Status == status);
        }
        if (query.Kind is not null)
        {
            if (query.Kind is not ("Complaint" or "Inquiry" or "Unclassified")) return BadRequest(new { message = "Invalid record kind." });
            records = query.Kind == "Unclassified" ? records.Where(x => x.Kind != "Complaint" && x.Kind != "Inquiry") : records.Where(x => x.Kind == query.Kind);
        }
        records = query.Queue switch
        {
            "open" => records.Where(x => x.Status != ComplaintStatus.Resolved && x.Status != ComplaintStatus.Closed),
            "completed" => records.Where(x => x.Status == ComplaintStatus.Resolved || x.Status == ComplaintStatus.Closed),
            "awaiting-review" => records.Where(x => x.Status == ComplaintStatus.Submitted || x.Status == ComplaintStatus.Reopened),
            "awaiting-ack" => records.Where(x => x.Assignments.Any(a => (actor.Monitor || actor.AuthorityRoleIds.Contains(a.AuthorityRoleId)) && a.Status == ComplaintAssignmentStatus.Pending)),
            "awaiting-response" => records.Where(x => x.Assignments.Any(a => (actor.Monitor || actor.AuthorityRoleIds.Contains(a.AuthorityRoleId)) && a.Status != ComplaintAssignmentStatus.Responded)),
            _ => records
        };
        if (query.AuthorityRoleId is { } roleId)
        {
            var roleIds = roleId == ComplaintAuthorities.SlcgId
                ? await db.Roles.Where(x => ComplaintAuthorities.SlcgRoles.Contains(x.Name!)).Select(x => x.Id).ToArrayAsync(ct)
                : new[] { roleId };
            if (!actor.Monitor)
            {
                roleIds = roleIds.Intersect(actor.AuthorityRoleIds).ToArray();
                if (roleIds.Length == 0) return Forbid();
            }
            records = records.Where(x => x.Assignments.Any(a => roleIds.Contains(a.AuthorityRoleId)));
        }
        if (query.From is { } from) records = records.Where(x => x.CreatedAtUtc >= from);
        if (query.To is { } to) records = records.Where(x => x.CreatedAtUtc < to);
        var total = await records.CountAsync(ct);
        var sorted = query.Sort switch
        {
            "oldest" => records.OrderBy(x => x.CreatedAtUtc),
            "passenger" => records.OrderBy(x => x.Passenger.Name),
            "updated" => records.OrderByDescending(x => x.UpdatedAtUtc),
            "newest" => records.OrderByDescending(x => x.CreatedAtUtc),
            _ => null
        };
        if (sorted is null) return BadRequest(new { message = "Invalid sort order." });
        var items = await sorted.ThenBy(x => x.Id).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(x => new ComplaintSummary(x.Id, "WWMS-" + x.Id.ToString(), x.Kind, x.PassengerId, x.Passenger.Name,
                x.TripId, x.Trip.Boat.Name, x.Type, x.Status.ToString(), x.CreatedAtUtc, x.UpdatedAtUtc,
                x.Assignments.Count(a => (actor.Monitor || actor.AuthorityRoleIds.Contains(a.AuthorityRoleId)) && a.Status != ComplaintAssignmentStatus.Responded)))
            .ToListAsync(ct);
        return Ok(new PageResult<ComplaintSummary>(items, total, query.Page, query.PageSize));
    }

    [HttpGet("authorities")]
    public async Task<ActionResult> Authorities(CancellationToken ct)
    {
        var actor = await access.ActorAsync(User, ct);
        if (actor is not { Monitor: true }) return Forbid();
        var now = DateTimeOffset.UtcNow;
        var roles = await db.Roles.AsNoTracking().Where(x => ComplaintAccess.AuthorityRoles.Contains(x.Name!))
            .Select(x => new { x.Id, Name = x.Name!, ActiveUsers = db.UserRoles.Count(m => m.RoleId == x.Id && db.Users.Any(u =>
                u.Id == m.UserId && u.EmailConfirmed && (u.LockoutEnd == null || u.LockoutEnd <= now))) })
            .OrderBy(x => x.Name).ToListAsync(ct);
        var authorities = roles.Where(x => !ComplaintAuthorities.SlcgRoles.Contains(x.Name))
            .Select(x => new ComplaintAuthority(x.Id, x.Name, x.ActiveUsers, [x.Id])).ToList();
        var slcg = roles.Where(x => ComplaintAuthorities.SlcgRoles.Contains(x.Name)).ToArray();
        if (slcg.Length > 0)
            authorities.Add(new(ComplaintAuthorities.SlcgId, "SLCG",
                slcg.Length == ComplaintAuthorities.SlcgRoles.Length ? slcg.Min(x => x.ActiveUsers) : 0,
                slcg.Select(x => x.Id).ToArray()));
        return Ok(authorities.OrderBy(x => x.Name));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult> Detail(Guid id, CancellationToken ct)
    {
        var actor = await access.ActorAsync(User, ct);
        if (actor is null) return Forbid();
        var complaint = await access.VisibleComplaints(actor).AsNoTracking().IgnoreQueryFilters().Where(x => x.Id == id)
            .Select(x => new { x.Id, Reference = "WWMS-" + x.Id.ToString(), x.Kind, x.PassengerId, PassengerName = x.Passenger.Name,
                Contact = actor.Monitor ? x.Passenger.PhoneNumber : null, x.Type, x.Message, Status = x.Status.ToString(), x.Version,
                x.CreatedAtUtc, x.UpdatedAtUtc, x.TripId, x.Trip.BoatId, BoatName = x.Trip.Boat.Name, x.Trip.Boat.RegistrationNumber,
                OwnerName = x.Trip.Boat.Owner.DisplayName, TripDate = x.Trip.ScheduledDepartureUtc, TripStatus = x.Trip.Status.ToString(),
                Evidence = x.Images.Select(i => new { i.Id, i.FileName }).ToList() }).SingleOrDefaultAsync(ct);
        if (complaint is null) return NotFound();
        var assignments = await db.ComplaintAssignments.AsNoTracking().Where(x => x.ComplaintId == id &&
                (actor.Monitor || actor.AuthorityRoleIds.Contains(x.AuthorityRoleId))).OrderBy(x => x.ForwardedAtUtc)
            .Select(x => new { x.Id, x.AuthorityRoleId, Authority = ComplaintAuthorities.DisplayName(x.AuthorityRole.Name), x.Note, Status = x.Status.ToString(),
                x.ForwardedAtUtc, ForwardedBy = x.ForwardedByUser.DisplayName, x.AcknowledgedAtUtc, x.RespondedAtUtc, x.UpdatedAtUtc,
                CanRespond = actor.AuthorityRoleIds.Contains(x.AuthorityRoleId) }).ToListAsync(ct);
        var timeline = await db.ComplaintEvents.AsNoTracking().Where(x => x.ComplaintId == id &&
                (actor.Monitor || (x.AssignmentId != null && actor.AuthorityRoleIds.Contains(x.Assignment!.AuthorityRoleId))))
            .OrderBy(x => x.CreatedAtUtc).ThenBy(x => x.Id)
            .Select(x => new { x.Id, x.AssignmentId, Authority = ComplaintAuthorities.DisplayName(x.Assignment == null ? null : x.Assignment.AuthorityRole.Name),
                Actor = x.ActorUser == null ? "Passenger / legacy record" : x.ActorUser.DisplayName, x.Action, x.Text,
                PreviousStatus = x.PreviousStatus.ToString(), Status = x.Status.ToString(),
                AssignmentStatus = x.AssignmentStatus == null ? null : x.AssignmentStatus.ToString(), x.CreatedAtUtc }).ToListAsync(ct);
        return Ok(new { Complaint = complaint, Assignments = assignments, Timeline = timeline, CanMonitor = actor.Monitor,
            AllowedStatuses = actor.Monitor ? Enum.GetValues<ComplaintStatus>().Where(s => ComplaintRules.CanTransition(
                Enum.Parse<ComplaintStatus>(complaint.Status), s, assignments.Any(a => a.Status != "Responded"))).Select(s => s.ToString()) : [] });
    }

    [HttpPost("{id:guid}/actions")]
    public async Task<ActionResult> Action(Guid id, ComplaintCommand command, CancellationToken ct)
    {
        var result = await workflow.ExecuteAsync(User, id, command, ct);
        return StatusCode(result.StatusCode, new { result.Message, result.EventId });
    }

    [HttpGet("{id:guid}/evidence/{imageId:guid}")]
    public async Task<ActionResult> Evidence(Guid id, Guid imageId, CancellationToken ct)
    {
        var actor = await access.ActorAsync(User, ct);
        if (actor is null) return Forbid();
        if (!await access.VisibleComplaints(actor).AnyAsync(x => x.Id == id, ct)) return NotFound();
        var image = await db.ComplaintImages.AsNoTracking().SingleOrDefaultAsync(x => x.ComplaintId == id && x.Id == imageId, ct);
        if (image is null) return NotFound();
        // Attachments are downloads: existing passenger uploads must never execute HTML/SVG in the portal origin.
        return File(image.Content, "application/octet-stream", image.FileName);
    }
}

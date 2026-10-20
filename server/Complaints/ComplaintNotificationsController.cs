using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;

namespace WhaleWatching.Api.Complaints;

[ApiController]
[Route("api/complaint-notifications")]
[Authorize(Policy = PortalPolicies.ComplaintAccess)]
public sealed class ComplaintNotificationsController(WhaleWatchingDbContext db, ComplaintAccess access, ComplaintWorkflow workflow) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> List([FromQuery] PageQuery query, CancellationToken ct)
    {
        var actor = await access.ActorAsync(User, ct);
        if (actor is null) return Forbid();
        var records = access.VisibleNotifications(actor).AsNoTracking();
        var total = await records.CountAsync(ct);
        var unread = await records.CountAsync(x => x.ReadAtUtc == null, ct);
        var items = await records.OrderByDescending(x => x.CreatedAtUtc).ThenBy(x => x.Id).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(x => new { x.Id, x.Event.ComplaintId, x.Event.AssignmentId, Reference = "WWMS-" + x.Event.ComplaintId.ToString(),
                x.Event.Action, Sender = x.Event.ActorUser == null ? "Passenger / legacy record" : x.Event.ActorUser.DisplayName,
                Category = x.Event.Complaint.Type, Kind = x.Event.Complaint.Kind,
                x.CreatedAtUtc, x.ReadAtUtc }).ToListAsync(ct);
        return Ok(new { Items = items, Total = total, query.Page, query.PageSize, Unread = unread });
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult> UnreadCount(CancellationToken ct)
    {
        var actor = await access.ActorAsync(User, ct);
        if (actor is null) return Forbid();
        return Ok(new { Unread = await access.VisibleNotifications(actor).CountAsync(x => x.ReadAtUtc == null, ct) });
    }

    [HttpPut("{id:guid}/read")]
    public async Task<ActionResult> Read(Guid id, ReadNotification request, CancellationToken ct)
    {
        var actor = await access.ActorAsync(User, ct);
        if (actor is null) return Forbid();
        var record = await access.VisibleNotifications(actor).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (record is null) return NotFound();
        record.ReadAtUtc = request.Read ? record.ReadAtUtc ?? DateTimeOffset.UtcNow : null;
        await db.SaveChangesAsync(ct);
        await workflow.PublishAsync([actor.Id], ct);
        return Ok(new { record.Id, record.ReadAtUtc });
    }
}

public sealed record ReadNotification(bool Read);

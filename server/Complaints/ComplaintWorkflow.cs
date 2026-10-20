using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Realtime;

namespace WhaleWatching.Api.Complaints;

public sealed record WorkflowResult(int StatusCode, string Message, Guid? EventId = null);

public sealed class ComplaintWorkflow(WhaleWatchingDbContext db, ComplaintAccess access,
    IHubContext<OperationsHub> hub, ILogger<ComplaintWorkflow> logger)
{
    public async Task<WorkflowResult> ExecuteAsync(ClaimsPrincipal principal, Guid complaintId,
        ComplaintCommand command, CancellationToken ct)
    {
        if (command.RequestId == Guid.Empty || command.Version == Guid.Empty ||
            command.Note?.Length > 2000 || command.Text?.Length > 4000 || command.AuthorityRoleIds?.Length > 12)
            return new(400, "Supply a request ID, current version, and valid field lengths.");
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(command))));
        var recipients = new List<Guid>();
        var result = await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            recipients.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var actor = await access.ActorAsync(principal, ct);
            if (actor is null) return new WorkflowResult(403, "Complaint access is not permitted.");
            var complaint = await access.VisibleComplaints(actor).Include(x => x.Assignments).SingleOrDefaultAsync(x => x.Id == complaintId, ct);
            if (complaint is null) return new WorkflowResult(404, "Complaint not found.");
            var prior = await db.ComplaintEvents.SingleOrDefaultAsync(x => x.ComplaintId == complaintId &&
                x.ActorUserId == actor.Id && x.RequestId == command.RequestId, ct);
            if (prior is not null) return prior.RequestHash == hash
                ? new WorkflowResult(200, "Action already recorded.", prior.Id)
                : new WorkflowResult(409, "This request ID was already used for a different action.");
            if (complaint.Version != command.Version) return new WorkflowResult(409, "This complaint changed. Refresh before submitting again.");
            var previous = complaint.Status;
            var now = DateTimeOffset.UtcNow;
            var entries = new List<ComplaintEvent>();
            ComplaintEvent Entry(string action, string? text, ComplaintAssignment? assignment = null)
            {
                var entry = new ComplaintEvent { Id = Guid.NewGuid(), ComplaintId = complaintId,
                    ActorUserId = actor.Id, Action = action, Text = text, Assignment = assignment,
                    PreviousStatus = previous, CreatedAtUtc = now, AssignmentStatus = assignment?.Status };
                entries.Add(entry);
                return entry;
            }
            if (command.Action == "forward")
            {
                if (!actor.Monitor) return new WorkflowResult(403, "Only complaint monitors may forward complaints.");
                if (complaint.Status is ComplaintStatus.Resolved or ComplaintStatus.Closed)
                    return new WorkflowResult(409, "Reopen this complaint before forwarding it.");
                var ids = command.AuthorityRoleIds?.Distinct().Order().ToArray() ?? [];
                if (ids.Length == 0) return new WorkflowResult(400, "Select at least one receiving authority.");
                var roles = await db.Roles.Where(x => ids.Contains(x.Id) && ComplaintAccess.AuthorityRoles.Contains(x.Name!)).ToListAsync(ct);
                if (roles.Count != ids.Length) return new WorkflowResult(400, "A selected authority is not eligible.");
                if (complaint.Assignments.Any(x => ids.Contains(x.AuthorityRoleId)))
                    return new WorkflowResult(409, "This complaint is already assigned to a selected authority.");
                // Validate every recipient before changing tracked workflow records.
                var receiving = new Dictionary<Guid, List<Guid>>();
                foreach (var role in roles)
                {
                    var eligible = await access.EligibleUsersAsync([role.Name!], ct);
                    if (eligible.Count == 0) return new WorkflowResult(400, "A selected authority has no active receiving users.");
                    receiving.Add(role.Id, eligible);
                }
                foreach (var role in roles)
                {
                    var assignment = new ComplaintAssignment { Id = Guid.NewGuid(), ComplaintId = complaintId,
                        AuthorityRoleId = role.Id, ForwardedByUserId = actor.Id, Note = command.Note?.Trim(),
                        ForwardedAtUtc = now, UpdatedAtUtc = now };
                    db.ComplaintAssignments.Add(assignment);
                    var entry = Entry("Forwarded", assignment.Note, assignment);
                    AddNotifications(entry, receiving[role.Id]);
                }
                complaint.Status = ComplaintRules.Aggregate(complaint.Assignments.Select(x => x.Status));
            }
            else if (command.Action == "assignment")
            {
                var assignment = complaint.Assignments.SingleOrDefault(x => x.Id == command.AssignmentId && actor.AuthorityRoleIds.Contains(x.AuthorityRoleId));
                if (assignment is null) return new WorkflowResult(404, "Assignment not found.");
                if (complaint.Status is ComplaintStatus.Resolved or ComplaintStatus.Closed)
                    return new WorkflowResult(409, "The complaint must be reopened before further authority updates.");
                if (!Enum.TryParse<ComplaintAssignmentStatus>(command.Status, out var status) || !Enum.IsDefined(status) ||
                    !ComplaintRules.CanUpdateAssignment(assignment.Status, status)) return new WorkflowResult(409, "Invalid assignment status transition.");
                if (status is ComplaintAssignmentStatus.InProgress or ComplaintAssignmentStatus.Responded && string.IsNullOrWhiteSpace(command.Text))
                    return new WorkflowResult(400, "Provide an official response or progress remark.");
                assignment.Status = status;
                assignment.UpdatedAtUtc = now;
                if (status == ComplaintAssignmentStatus.Acknowledged) assignment.AcknowledgedAtUtc = now;
                if (status == ComplaintAssignmentStatus.Responded) assignment.RespondedAtUtc = now;
                Entry(status == ComplaintAssignmentStatus.Acknowledged ? "Acknowledged" : "Authority update", command.Text?.Trim(), assignment);
                complaint.Status = ComplaintRules.Aggregate(complaint.Assignments.Select(x => x.Status));
            }
            else if (command.Action == "status")
            {
                if (!actor.Monitor) return new WorkflowResult(403, "Only complaint monitors may change the overall status.");
                if (!Enum.TryParse<ComplaintStatus>(command.Status, out var status) || !Enum.IsDefined(status) ||
                    !ComplaintRules.CanTransition(complaint.Status, status, complaint.Assignments.Any(x => x.Status != ComplaintAssignmentStatus.Responded)))
                    return new WorkflowResult(409, "Invalid complaint transition or outstanding authority responses.");
                if (string.IsNullOrWhiteSpace(command.Text)) return new WorkflowResult(400, "Provide a review or status-change remark.");
                complaint.Status = status;
                Entry(status == ComplaintStatus.UnderReview ? "Reviewed" : status.ToString(), command.Text.Trim());
                if (status == ComplaintStatus.Reopened)
                {
                    // Previously completed assignments remain auditable and now require a fresh response.
                    foreach (var assignment in complaint.Assignments)
                    {
                        assignment.Status = assignment.AcknowledgedAtUtc is null ? ComplaintAssignmentStatus.Pending : ComplaintAssignmentStatus.InProgress;
                        assignment.RespondedAtUtc = null;
                        assignment.UpdatedAtUtc = now;
                        var entry = Entry("Further action required", command.Text.Trim(), assignment);
                        var roleName = await db.Roles.Where(x => x.Id == assignment.AuthorityRoleId).Select(x => x.Name).SingleAsync(ct);
                        AddNotifications(entry, await access.EligibleUsersAsync([roleName!], ct));
                    }
                }
            }
            else return new WorkflowResult(400, "Unknown complaint action.");

            complaint.UpdatedAtUtc = now;
            complaint.Version = Guid.NewGuid();
            foreach (var entry in entries) entry.Status = complaint.Status;
            entries[0].RequestId = command.RequestId;
            entries[0].RequestHash = hash;
            db.ComplaintEvents.AddRange(entries);
            // One monitoring notification per action, even for multi-authority forwarding.
            AddNotifications(entries[0], (await access.EligibleUsersAsync(ComplaintAccess.MonitorRoles, ct)).Except(recipients.ToArray()));
            try
            {
                await db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
            }
            catch (DbUpdateConcurrencyException) { return new WorkflowResult(409, "This complaint changed. Refresh and try again."); }
            return new WorkflowResult(200, "Complaint action recorded.", entries[0].Id);

            void AddNotifications(ComplaintEvent entry, IEnumerable<Guid> users)
            {
                foreach (var id in users.Distinct())
                {
                    if (db.ComplaintNotifications.Local.Any(x => x.EventId == entry.Id && x.RecipientUserId == id)) continue;
                    db.ComplaintNotifications.Add(new ComplaintNotification { Id = Guid.NewGuid(), Event = entry,
                        RecipientUserId = id, CreatedAtUtc = now });
                    recipients.Add(id);
                }
            }
        });
        if (result.StatusCode == 200) await PublishAsync(recipients, ct);
        return result;
    }

    public async Task RecordSubmissionAsync(PassengerComplaint complaint, CancellationToken ct)
    {
        complaint.UpdatedAtUtc = complaint.CreatedAtUtc;
        var entry = new ComplaintEvent { Id = Guid.NewGuid(), Complaint = complaint,
            Action = "Submitted", CreatedAtUtc = complaint.CreatedAtUtc };
        db.ComplaintEvents.Add(entry);
        foreach (var userId in await access.EligibleUsersAsync(ComplaintAccess.MonitorRoles, ct))
            db.ComplaintNotifications.Add(new ComplaintNotification { Id = Guid.NewGuid(), Event = entry,
                RecipientUserId = userId, CreatedAtUtc = complaint.CreatedAtUtc });
    }

    public async Task PublishAsync(IEnumerable<Guid> users, CancellationToken ct)
    {
        try
        {
            foreach (var id in users.Distinct())
                await hub.Clients.Group($"user:{id}").SendAsync("operationsChanged", new { kind = "complaints" }, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Persisted notifications remain available through polling if live delivery is unavailable.
            logger.LogWarning("Complaint notification live refresh unavailable ({ExceptionType}).", ex.GetType().Name);
        }
    }
}

public sealed record ComplaintCommand(Guid RequestId, Guid Version, string Action,
    Guid[]? AuthorityRoleIds = null, string? Note = null, Guid? AssignmentId = null, string? Status = null, string? Text = null);

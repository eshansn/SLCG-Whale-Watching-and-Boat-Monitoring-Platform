using Microsoft.AspNetCore.Identity;

namespace WhaleWatching.Api.Domain;

public enum ComplaintStatus { Submitted, UnderReview, Forwarded, Acknowledged, InProgress, Responded, Resolved, Closed, Reopened }
public enum ComplaintAssignmentStatus { Pending, Acknowledged, InProgress, Responded }

public sealed class ComplaintAssignment
{
    public Guid Id { get; set; }
    public Guid ComplaintId { get; set; }
    public PassengerComplaint Complaint { get; set; } = null!;
    public Guid AuthorityRoleId { get; set; }
    public IdentityRole<Guid> AuthorityRole { get; set; } = null!;
    public Guid ForwardedByUserId { get; set; }
    public ApplicationUser ForwardedByUser { get; set; } = null!;
    public string? Note { get; set; }
    public ComplaintAssignmentStatus Status { get; set; }
    public DateTimeOffset ForwardedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? AcknowledgedAtUtc { get; set; }
    public DateTimeOffset? RespondedAtUtc { get; set; }
}

// Append-only events are also the response/remark and status-transition history.
public sealed class ComplaintEvent
{
    public Guid Id { get; set; }
    public Guid ComplaintId { get; set; }
    public PassengerComplaint Complaint { get; set; } = null!;
    public Guid? AssignmentId { get; set; }
    public ComplaintAssignment? Assignment { get; set; }
    public Guid? ActorUserId { get; set; }
    public ApplicationUser? ActorUser { get; set; }
    public string Action { get; set; } = "";
    public string? Text { get; set; }
    public ComplaintStatus PreviousStatus { get; set; }
    public ComplaintStatus Status { get; set; }
    public ComplaintAssignmentStatus? AssignmentStatus { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public Guid? RequestId { get; set; }
    public string? RequestHash { get; set; }
}

public sealed class ComplaintNotification
{
    public Guid Id { get; set; }
    public Guid RecipientUserId { get; set; }
    public ApplicationUser RecipientUser { get; set; } = null!;
    public Guid EventId { get; set; }
    public ComplaintEvent Event { get; set; } = null!;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? ReadAtUtc { get; set; }
}

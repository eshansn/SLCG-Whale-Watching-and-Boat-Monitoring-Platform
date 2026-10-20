using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Complaints;

public static class ComplaintRules
{
    public static bool CanTransition(ComplaintStatus from, ComplaintStatus to, bool pendingAssignments) => (from, to) switch
    {
        (ComplaintStatus.Submitted, ComplaintStatus.UnderReview) => true,
        (ComplaintStatus.Reopened, ComplaintStatus.UnderReview) => true,
        (ComplaintStatus.UnderReview or ComplaintStatus.Responded, ComplaintStatus.Resolved) => !pendingAssignments,
        (ComplaintStatus.Resolved, ComplaintStatus.Closed) => !pendingAssignments,
        (ComplaintStatus.Resolved or ComplaintStatus.Closed, ComplaintStatus.Reopened) => true,
        _ => false
    };

    public static bool CanUpdateAssignment(ComplaintAssignmentStatus from, ComplaintAssignmentStatus to) => (from, to) switch
    {
        (ComplaintAssignmentStatus.Pending, ComplaintAssignmentStatus.Acknowledged) => true,
        (ComplaintAssignmentStatus.Acknowledged, ComplaintAssignmentStatus.InProgress or ComplaintAssignmentStatus.Responded) => true,
        (ComplaintAssignmentStatus.InProgress, ComplaintAssignmentStatus.InProgress or ComplaintAssignmentStatus.Responded) => true,
        (ComplaintAssignmentStatus.Responded, ComplaintAssignmentStatus.Responded or ComplaintAssignmentStatus.InProgress) => true,
        _ => false
    };

    public static ComplaintStatus Aggregate(IEnumerable<ComplaintAssignmentStatus> statuses)
    {
        var values = statuses.ToArray();
        if (values.Length == 0) return ComplaintStatus.UnderReview;
        if (values.All(x => x == ComplaintAssignmentStatus.Responded)) return ComplaintStatus.Responded;
        if (values.Any(x => x is ComplaintAssignmentStatus.InProgress or ComplaintAssignmentStatus.Responded)) return ComplaintStatus.InProgress;
        if (values.All(x => x == ComplaintAssignmentStatus.Acknowledged)) return ComplaintStatus.Acknowledged;
        return ComplaintStatus.Forwarded;
    }
}

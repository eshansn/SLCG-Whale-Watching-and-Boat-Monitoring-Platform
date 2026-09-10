using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Operations;

internal static class TripWorkflowRules
{
    private static readonly TimeSpan SriLankaUtcOffset = TimeSpan.FromMinutes(330);
    private static readonly TimeSpan LateAfter = TimeSpan.FromMinutes(30);

    internal static bool RequiresTouristClearance(TripType type) => type == TripType.WhaleWatching;

    internal static IReadOnlyList<string> GetIncompleteTouristApprovals(
        ApprovalStatus administrativeBoatApproval, ApprovalStatus wildlifeBoatApproval,
        ApprovalStatus shoreApproval, ApprovalStatus wildlifeShoreApproval)
    {
        var incompleteApprovals = new List<string>();
        if (administrativeBoatApproval != ApprovalStatus.Approved &&
            wildlifeBoatApproval != ApprovalStatus.Approved)
            incompleteApprovals.Add("boat approval from either Administration or the Wildlife Authority");
        if (shoreApproval != ApprovalStatus.Approved)
            incompleteApprovals.Add("SLCG shore approval");
        if (wildlifeShoreApproval != ApprovalStatus.Approved)
            incompleteApprovals.Add("wildlife shore approval");
        return incompleteApprovals;
    }

    internal static bool IsExpiredScheduledTrip(TripStatus status, DateTimeOffset scheduledDepartureUtc,
        DateTimeOffset nowUtc) => IsAwaitingDeparture(status) &&
            scheduledDepartureUtc < GetSriLankaDayStartUtc(nowUtc);

    internal static bool IsLateScheduledTrip(TripStatus status, DateTimeOffset scheduledDepartureUtc,
        DateTimeOffset nowUtc) => IsAwaitingDeparture(status) &&
            !IsExpiredScheduledTrip(status, scheduledDepartureUtc, nowUtc) &&
            nowUtc >= scheduledDepartureUtc.Add(LateAfter);

    internal static DateTimeOffset GetSriLankaDayStartUtc(DateTimeOffset nowUtc)
    {
        var localNow = nowUtc.ToOffset(SriLankaUtcOffset);
        return new DateTimeOffset(localNow.Year, localNow.Month, localNow.Day,
            0, 0, 0, SriLankaUtcOffset).ToUniversalTime();
    }

    internal static bool CanReschedule(TripStatus status) => IsAwaitingDeparture(status);

    private static bool IsAwaitingDeparture(TripStatus status) =>
        status is TripStatus.Scheduled or TripStatus.Boarding;
}

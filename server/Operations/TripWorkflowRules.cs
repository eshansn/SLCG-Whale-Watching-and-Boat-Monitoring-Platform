using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Operations;

internal static class TripWorkflowRules
{
    internal static bool RequiresTouristClearance(TripType type) => type == TripType.WhaleWatching;

    internal static bool IsExpiredScheduledTrip(TripStatus status, DateTimeOffset scheduledDepartureUtc,
        DateTimeOffset nowUtc) => status == TripStatus.Scheduled && scheduledDepartureUtc < nowUtc;

    internal static bool CanReschedule(TripStatus status) => status == TripStatus.Scheduled;
}

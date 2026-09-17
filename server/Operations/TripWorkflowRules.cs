using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Operations;

internal static class TripWorkflowRules
{
    private static readonly TimeSpan SriLankaUtcOffset = TimeSpan.FromMinutes(330);
    private static readonly TimeSpan LateAfter = TimeSpan.FromMinutes(30);

    internal static bool CanStart(TripStatus status) =>
        status is TripStatus.Scheduled or TripStatus.Boarding or TripStatus.NeedsReschedule;

    internal static bool CanDecline(TripStatus status) =>
        status is TripStatus.Scheduled or TripStatus.Boarding or TripStatus.NeedsReschedule;

    internal static bool CanEnd(TripStatus status) => status == TripStatus.Ongoing;

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

    internal static bool CanReschedule(TripStatus status) =>
        IsAwaitingDeparture(status) || status == TripStatus.NeedsReschedule;

    private static bool IsAwaitingDeparture(TripStatus status) =>
        status is TripStatus.Scheduled or TripStatus.Boarding or TripStatus.NeedsReschedule;
}

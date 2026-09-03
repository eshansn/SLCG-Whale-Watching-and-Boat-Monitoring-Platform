using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Gps;

namespace WhaleWatching.Api.Operations;

public sealed class TripTrackingService(
    WhaleWatchingDbContext db,
    GpsHistoryService gpsHistory,
    IOptions<TrackMyCarOptions> options,
    TimeProvider timeProvider)
{
    private readonly TrackingStopSettings _stopSettings = new(options.Value.StopSpeedThresholdKnots,
        TimeSpan.FromMinutes(options.Value.RouteMinimumStopMinutes));

    internal async Task<TripTrackingSnapshot?> GetAsync(Guid tripId, bool synchronizeProviderHistory,
        CancellationToken cancellationToken)
    {
        var trip = await db.Trips.AsNoTracking().Where(item => item.Id == tripId)
            .Select(item => new
            {
                item.Id,
                item.BoatId,
                item.Status,
                item.ActualDepartureUtc,
                item.ActualArrivalUtc,
                item.UpdatedAtUtc,
                item.Boat.GpsDeviceId
            }).SingleOrDefaultAsync(cancellationToken);
        if (trip is null) return null;

        if (trip.ActualDepartureUtc is null)
            return new TripTrackingSnapshot(trip.Id, trip.BoatId, "NotStarted", null, null,
                null, null, null, null, [], []);

        var startedAtUtc = trip.ActualDepartureUtc.Value;
        var isActive = trip.Status == TripStatus.Ongoing && trip.ActualArrivalUtc is null;
        DateTimeOffset? endedAtUtc = isActive ? null : trip.ActualArrivalUtc ?? trip.UpdatedAtUtc;
        var queryEndUtc = endedAtUtc ?? timeProvider.GetUtcNow();
        if (synchronizeProviderHistory)
            await gpsHistory.EnsureRangeAsync(trip.GpsDeviceId, startedAtUtc, queryEndUtc, cancellationToken);

        List<TrackingTelemetryPoint> telemetry = [];
        if (trip.GpsDeviceId is not null)
            telemetry = await db.GpsTelemetry.AsNoTracking()
                .Where(item => item.DeviceId == trip.GpsDeviceId && item.RecordedAtUtc >= startedAtUtc &&
                    item.RecordedAtUtc <= queryEndUtc && item.Latitude >= -90 && item.Latitude <= 90 &&
                    item.Longitude >= -180 && item.Longitude <= 180)
                .OrderBy(item => item.RecordedAtUtc).ThenBy(item => item.Id)
                .Select(item => new TrackingTelemetryPoint(item.Latitude, item.Longitude,
                    item.RecordedAtUtc, item.SpeedKnots, item.HeadingDegrees))
                .ToListAsync(cancellationToken);

        var calculationEndUtc = endedAtUtc ?? telemetry.LastOrDefault()?.RecordedAtUtc ?? startedAtUtc;
        var metrics = TripTrackingCalculator.Calculate(startedAtUtc, calculationEndUtc, telemetry, _stopSettings);
        var stops = TripTrackingCalculator.DetectStops(telemetry, _stopSettings, isActive);
        return new TripTrackingSnapshot(trip.Id, trip.BoatId, isActive ? "Active" : "Completed",
            startedAtUtc, endedAtUtc, metrics?.RouteLengthKilometers, metrics?.MoveDurationSeconds,
            metrics?.StopsDurationSeconds, metrics?.AverageSpeedKnots, telemetry, stops);
    }

    internal async Task<TripTrackingSnapshot?> GetActiveForBoatAsync(Guid boatId,
        CancellationToken cancellationToken)
    {
        var tripId = await db.Trips.AsNoTracking()
            .Where(trip => trip.BoatId == boatId && trip.Status == TripStatus.Ongoing &&
                trip.ActualDepartureUtc != null && trip.ActualArrivalUtc == null)
            .OrderByDescending(trip => trip.ActualDepartureUtc)
            .Select(trip => (Guid?)trip.Id)
            .FirstOrDefaultAsync(cancellationToken);
        return tripId is null ? null : await GetAsync(tripId.Value, false, cancellationToken);
    }

    internal TrackingMetrics? CalculateMetrics(DateTimeOffset startedAtUtc, DateTimeOffset endedAtUtc,
        IReadOnlyList<TrackingTelemetryPoint> telemetry) =>
        TripTrackingCalculator.Calculate(startedAtUtc, endedAtUtc, telemetry, _stopSettings);
}

internal sealed record TripTrackingSnapshot(Guid TripId, Guid BoatId, string Status,
    DateTimeOffset? StartedAtUtc, DateTimeOffset? EndedAtUtc, double? RouteLengthKilometers,
    long? MoveDurationSeconds, long? StopsDurationSeconds, decimal? AverageSpeedKnots,
    IReadOnlyList<TrackingTelemetryPoint> Route, IReadOnlyList<TrackingStop> Stops);

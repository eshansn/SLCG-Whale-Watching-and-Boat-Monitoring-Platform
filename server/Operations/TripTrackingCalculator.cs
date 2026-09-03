namespace WhaleWatching.Api.Operations;

internal static class TripTrackingCalculator
{
    internal const double KilometersPerNauticalMile = 1.852;

    internal static TrackingMetrics? Calculate(DateTimeOffset startedAtUtc, DateTimeOffset endedAtUtc,
        IReadOnlyList<TrackingTelemetryPoint> telemetry, TrackingStopSettings stopSettings)
    {
        if (telemetry.Count < 2) return null;

        double distanceKilometers = 0;
        double moveSeconds = 0;
        for (var index = 1; index < telemetry.Count; index++)
        {
            var previous = telemetry[index - 1];
            var current = telemetry[index];
            var segmentKilometers = HaversineKilometers(previous.Latitude, previous.Longitude,
                current.Latitude, current.Longitude);
            distanceKilometers += segmentKilometers;

            var segmentSeconds = (current.RecordedAtUtc - previous.RecordedAtUtc).TotalSeconds;
            if (segmentSeconds <= 0) continue;
            var measuredSpeed = previous.SpeedKnots ?? current.SpeedKnots;
            var derivedSpeedKnots = segmentKilometers / KilometersPerNauticalMile /
                (segmentSeconds / 3600d);
            if (measuredSpeed >= stopSettings.SpeedThresholdKnots ||
                (measuredSpeed is null && derivedSpeedKnots >= (double)stopSettings.SpeedThresholdKnots))
                moveSeconds += segmentSeconds;
        }

        var elapsedSeconds = Math.Max(0, (endedAtUtc - startedAtUtc).TotalSeconds);
        moveSeconds = Math.Min(moveSeconds, elapsedSeconds);
        var averageSpeedKnots = moveSeconds > 0
            ? Math.Round((decimal)(distanceKilometers / KilometersPerNauticalMile /
                (moveSeconds / 3600d)), 2)
            : (decimal?)null;

        var stopsDurationSeconds = DetectStops(telemetry, stopSettings, false).Sum(stop => stop.DurationSeconds);
        return new TrackingMetrics(Math.Round(distanceKilometers, 3), (long)Math.Round(moveSeconds),
            stopsDurationSeconds, averageSpeedKnots);
    }

    internal static IReadOnlyList<TrackingStop> DetectStops(IReadOnlyList<TrackingTelemetryPoint> telemetry,
        TrackingStopSettings settings, bool tripIsOngoing)
    {
        if (telemetry.Count < 2) return [];

        var stops = new List<TrackingStop>();
        var candidateStartIndex = -1;
        for (var index = 0; index < telemetry.Count; index++)
        {
            if (IsStationary(telemetry, index, settings.SpeedThresholdKnots))
            {
                if (candidateStartIndex < 0) candidateStartIndex = index;
                continue;
            }

            if (candidateStartIndex >= 0)
            {
                AddStop(stops, telemetry, candidateStartIndex, index - 1,
                    telemetry[index].RecordedAtUtc, false, settings.MinimumDuration);
                candidateStartIndex = -1;
            }
        }

        if (candidateStartIndex >= 0)
        {
            var lastIndex = telemetry.Count - 1;
            AddStop(stops, telemetry, candidateStartIndex, lastIndex,
                tripIsOngoing ? null : telemetry[lastIndex].RecordedAtUtc,
                tripIsOngoing, settings.MinimumDuration);
        }

        return stops;
    }

    private static bool IsStationary(IReadOnlyList<TrackingTelemetryPoint> telemetry, int index,
        decimal speedThresholdKnots)
    {
        var current = telemetry[index];
        if (current.SpeedKnots is not null) return Math.Abs(current.SpeedKnots.Value) < speedThresholdKnots;
        if (index == 0) return false;

        var previous = telemetry[index - 1];
        var seconds = (current.RecordedAtUtc - previous.RecordedAtUtc).TotalSeconds;
        if (seconds <= 0) return false;
        var distance = HaversineKilometers(previous.Latitude, previous.Longitude,
            current.Latitude, current.Longitude);
        var derivedSpeedKnots = distance / KilometersPerNauticalMile / (seconds / 3600d);
        return derivedSpeedKnots < (double)speedThresholdKnots;
    }

    private static void AddStop(ICollection<TrackingStop> stops,
        IReadOnlyList<TrackingTelemetryPoint> telemetry, int startIndex, int lastStationaryIndex,
        DateTimeOffset? endedAtUtc, bool isOngoing, TimeSpan minimumDuration)
    {
        var startedAtUtc = telemetry[startIndex].RecordedAtUtc;
        var durationEnd = endedAtUtc ?? telemetry[lastStationaryIndex].RecordedAtUtc;
        var durationSeconds = Math.Max(0, (long)Math.Round((durationEnd - startedAtUtc).TotalSeconds));
        if (durationSeconds < minimumDuration.TotalSeconds) return;

        var stationaryPoints = telemetry.Skip(startIndex).Take(lastStationaryIndex - startIndex + 1).ToArray();
        stops.Add(new TrackingStop(startedAtUtc, endedAtUtc, durationSeconds,
            stationaryPoints.Average(point => point.Latitude),
            stationaryPoints.Average(point => point.Longitude), isOngoing));
    }

    private static double HaversineKilometers(decimal latitude1, decimal longitude1,
        decimal latitude2, decimal longitude2)
    {
        const double earthRadiusKilometers = 6371.0088;
        static double Radians(decimal degrees) => (double)degrees * Math.PI / 180d;
        var lat1 = Radians(latitude1);
        var lat2 = Radians(latitude2);
        var deltaLatitude = lat2 - lat1;
        var deltaLongitude = Radians(longitude2 - longitude1);
        var haversine = Math.Pow(Math.Sin(deltaLatitude / 2d), 2d) +
            Math.Cos(lat1) * Math.Cos(lat2) * Math.Pow(Math.Sin(deltaLongitude / 2d), 2d);
        haversine = Math.Clamp(haversine, 0d, 1d);
        return earthRadiusKilometers * 2d * Math.Atan2(Math.Sqrt(haversine), Math.Sqrt(1d - haversine));
    }
}

internal sealed record TrackingMetrics(double RouteLengthKilometers, long MoveDurationSeconds,
    long StopsDurationSeconds, decimal? AverageSpeedKnots);

internal sealed record TrackingTelemetryPoint(decimal Latitude, decimal Longitude,
    DateTimeOffset RecordedAtUtc, decimal? SpeedKnots, decimal? HeadingDegrees = null);

internal sealed record TrackingStopSettings(decimal SpeedThresholdKnots, TimeSpan MinimumDuration);

internal sealed record TrackingStop(DateTimeOffset StartedAtUtc, DateTimeOffset? EndedAtUtc,
    long DurationSeconds, decimal Latitude, decimal Longitude, bool IsOngoing);

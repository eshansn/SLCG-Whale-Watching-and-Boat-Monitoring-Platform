using WhaleWatching.Api.Operations;

namespace WhaleWatching.Api.Tests;

public sealed class TripTrackingCalculatorTests
{
    private static readonly TrackingStopSettings Settings =
        new(0.5m, TimeSpan.FromMinutes(2), 30);
    private static readonly DateTimeOffset Start = new(2026, 9, 2, 4, 0, 0, TimeSpan.Zero);

    [Fact]
    public void DetectStops_ignores_one_temporary_zero_speed_reading()
    {
        var points = new[] { Point(0, 4), Point(1, 0), Point(5, 4) };

        Assert.Empty(TripTrackingCalculator.DetectStops(points, Settings, true));
    }

    [Fact]
    public void DetectStops_ignores_stationary_period_below_minimum_duration()
    {
        var points = new[] { Point(0, 0), Point(1, 0), Point(1.5, 4) };

        Assert.Empty(TripTrackingCalculator.DetectStops(points, Settings, true));
    }

    [Fact]
    public void DetectStops_groups_stationary_jitter_inside_radius_into_one_stop()
    {
        var points = new[]
        {
            Point(0, 0),
            Point(1, 0, 5.94710m),
            Point(3, 0, 5.94690m)
        };

        var stop = Assert.Single(TripTrackingCalculator.DetectStops(points, Settings, true));

        Assert.True(stop.IsOngoing);
        Assert.Null(stop.EndedAtUtc);
        Assert.Equal(180, stop.DurationSeconds);
        Assert.InRange(stop.Latitude, 5.94699m, 5.94701m);
    }

    [Fact]
    public void DetectStops_does_not_merge_low_speed_readings_outside_radius()
    {
        var points = new[]
        {
            Point(0, 0),
            Point(3, 0, 5.94750m),
            Point(4, 4, 5.94800m)
        };

        Assert.Empty(TripTrackingCalculator.DetectStops(points, Settings, true));
    }

    [Fact]
    public void DetectStops_keeps_one_ongoing_stop_while_stationary_updates_continue()
    {
        var points = new[] { Point(0, 0), Point(1, 0), Point(2, 0), Point(5, 0) };

        var stop = Assert.Single(TripTrackingCalculator.DetectStops(points, Settings, true));

        Assert.True(stop.IsOngoing);
        Assert.Null(stop.EndedAtUtc);
        Assert.Equal(300, stop.DurationSeconds);
        Assert.Equal(0m, stop.SpeedKnots);
    }

    [Fact]
    public void DetectStops_finalizes_stop_when_movement_resumes()
    {
        var points = new[] { Point(0, 0), Point(1, 0), Point(3, 0), Point(4, 3) };

        var stop = Assert.Single(TripTrackingCalculator.DetectStops(points, Settings, true));

        Assert.False(stop.IsOngoing);
        Assert.Equal(Start.AddMinutes(4), stop.EndedAtUtc);
        Assert.Equal(240, stop.DurationSeconds);
    }

    [Fact]
    public void DetectStops_returns_each_valid_stop_once()
    {
        var points = new[]
        {
            Point(0, 0), Point(2, 0), Point(3, 4),
            Point(4, 0), Point(6, 0), Point(7, 4)
        };

        var stops = TripTrackingCalculator.DetectStops(points, Settings, true);

        Assert.Equal(2, stops.Count);
        Assert.All(stops, stop => Assert.False(stop.IsOngoing));
    }

    [Fact]
    public void DetectStops_marks_final_historical_stop_as_completed()
    {
        var points = new[] { Point(0, 0), Point(3, 0) };

        var stop = Assert.Single(TripTrackingCalculator.DetectStops(points, Settings, false));

        Assert.False(stop.IsOngoing);
        Assert.Equal(Start.AddMinutes(3), stop.EndedAtUtc);
        Assert.Equal(180, stop.DurationSeconds);
    }

    [Fact]
    public void DetectStops_ignores_duplicate_stationary_timestamps()
    {
        var points = new[] { Point(0, 0), Point(0, 0), Point(0, 0) };

        Assert.Empty(TripTrackingCalculator.DetectStops(points, Settings, true));
    }

    private static TrackingTelemetryPoint Point(double minutes, decimal speedKnots,
        decimal latitude = 5.947m, decimal longitude = 80.450m) =>
        new(latitude, longitude, Start.AddMinutes(minutes), speedKnots);
}

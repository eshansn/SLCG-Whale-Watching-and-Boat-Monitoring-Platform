using WhaleWatching.Api.Operations;

namespace WhaleWatching.Api.Tests;

public sealed class TripTrackingCalculatorTests
{
    private static readonly TrackingStopSettings Settings = new(0.5m, TimeSpan.FromMinutes(10));
    private static readonly DateTimeOffset Start = new(2026, 9, 2, 4, 0, 0, TimeSpan.Zero);

    [Fact]
    public void DetectStops_ignores_short_stationary_period()
    {
        var points = new[] { Point(0, 0), Point(5, 0), Point(9, 0), Point(9.5, 4) };

        Assert.Empty(TripTrackingCalculator.DetectStops(points, Settings, true));
    }

    [Fact]
    public void DetectStops_keeps_one_ongoing_stop_while_stationary_updates_continue()
    {
        var points = new[] { Point(0, 0), Point(5, 0), Point(10, 0), Point(15, 0) };

        var stop = Assert.Single(TripTrackingCalculator.DetectStops(points, Settings, true));

        Assert.True(stop.IsOngoing);
        Assert.Null(stop.EndedAtUtc);
        Assert.Equal(900, stop.DurationSeconds);
    }

    [Fact]
    public void DetectStops_finalizes_stop_when_movement_resumes()
    {
        var points = new[] { Point(0, 0), Point(5, 0), Point(10, 0), Point(12, 3) };

        var stop = Assert.Single(TripTrackingCalculator.DetectStops(points, Settings, true));

        Assert.False(stop.IsOngoing);
        Assert.Equal(Start.AddMinutes(12), stop.EndedAtUtc);
        Assert.Equal(720, stop.DurationSeconds);
    }

    [Fact]
    public void DetectStops_returns_each_valid_stop_once()
    {
        var points = new[]
        {
            Point(0, 0), Point(10, 0), Point(11, 3),
            Point(12, 0), Point(22, 0), Point(23, 4)
        };

        var stops = TripTrackingCalculator.DetectStops(points, Settings, true);

        Assert.Equal(2, stops.Count);
        Assert.All(stops, stop => Assert.False(stop.IsOngoing));
    }

    private static TrackingTelemetryPoint Point(double minutes, decimal speedKnots) =>
        new(5.947m, 80.450m, Start.AddMinutes(minutes), speedKnots);
}

using WhaleWatching.Api.Gps;

namespace WhaleWatching.Api.Tests;

public sealed class GpsTelemetryIngestorTests
{
    [Fact]
    public void Plan_maps_imei_deduplicates_unknown_devices_and_converts_speed_once()
    {
        var boatId = Guid.NewGuid();
        var firstAt = new DateTimeOffset(2026, 9, 2, 8, 0, 0, TimeSpan.Zero);
        var secondAt = firstAt.AddSeconds(10);
        var positions = new[]
        {
            Position("351535133742000", firstAt, 18.52m),
            Position("351535133742000", secondAt, 37.04m),
            Position("999999999999999", secondAt, 10m)
        };
        var boats = new Dictionary<string, GpsBoatMatch>
        {
            ["351535133742000"] = new(boatId, "351535133742000")
        };
        var existing = new HashSet<GpsTelemetryKey>
        {
            new("351535133742000", firstAt)
        };

        var plan = GpsTelemetryIngestor.Plan(positions, boats, existing, secondAt.AddSeconds(1));

        var accepted = Assert.Single(plan.Accepted);
        Assert.Equal(boatId, accepted.BoatId);
        Assert.Equal(20m, accepted.Telemetry.SpeedKnots);
        Assert.Equal(1, plan.DuplicateCount);
        Assert.Equal(1, plan.UnknownDeviceCount);
    }

    [Theory]
    [InlineData(-91, 80)]
    [InlineData(91, 80)]
    [InlineData(6, -181)]
    [InlineData(6, 181)]
    public void Invalid_coordinates_are_rejected(decimal latitude, decimal longitude)
    {
        var position = Position("351535133742000", DateTimeOffset.UtcNow, 0m) with
        {
            Latitude = latitude,
            Longitude = longitude
        };

        Assert.False(GpsTelemetryIngestor.IsValid(position));
    }

    private static GpsPosition Position(string deviceId, DateTimeOffset recordedAtUtc, decimal speed) =>
        new(deviceId, 6.1m, 80.2m, speed, 90m, 4m, recordedAtUtc,
            new Dictionary<string, string>());
}

using WhaleWatching.Api.Gps;

namespace WhaleWatching.Api.Tests;

public sealed class GpsTrackerStatusTests
{
    [Fact]
    public void Status_thresholds_are_applied_by_backend()
    {
        var now = new DateTimeOffset(2026, 9, 2, 8, 0, 0, TimeSpan.Zero);

        Assert.Equal("Online", GpsTrackerStatus.Classify(now.AddSeconds(-30), now, 60, 300));
        Assert.Equal("Stale", GpsTrackerStatus.Classify(now.AddSeconds(-90), now, 60, 300));
        Assert.Equal("Offline", GpsTrackerStatus.Classify(now.AddSeconds(-301), now, 60, 300));
        Assert.Equal("Offline", GpsTrackerStatus.Classify(null, now, 60, 300));
    }
}

using Microsoft.Extensions.Options;

namespace WhaleWatching.Api.Gps;

public sealed class GpsTrackerStatus(IOptions<TrackMyCarOptions> options, TimeProvider timeProvider)
{
    private readonly TrackMyCarOptions _options = options.Value;

    public string Classify(DateTimeOffset? recordedAtUtc) =>
        Classify(recordedAtUtc, timeProvider.GetUtcNow(), _options.StaleAfterSeconds,
            _options.OfflineAfterSeconds);

    internal static string Classify(DateTimeOffset? recordedAtUtc, DateTimeOffset nowUtc,
        int staleAfterSeconds, int offlineAfterSeconds)
    {
        if (recordedAtUtc is null) return "Offline";
        var age = nowUtc - recordedAtUtc.Value;
        if (age <= TimeSpan.FromSeconds(staleAfterSeconds)) return "Online";
        return age <= TimeSpan.FromSeconds(offlineAfterSeconds) ? "Stale" : "Offline";
    }
}

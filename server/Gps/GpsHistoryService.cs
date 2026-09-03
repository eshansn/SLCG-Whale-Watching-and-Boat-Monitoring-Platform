using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using WhaleWatching.Api.Data;

namespace WhaleWatching.Api.Gps;

public sealed class GpsHistoryService(
    WhaleWatchingDbContext db,
    IGpsProvider provider,
    GpsTelemetryIngestor ingestor,
    IMemoryCache cache,
    IOptions<TrackMyCarOptions> options,
    TimeProvider timeProvider,
    ILogger<GpsHistoryService> logger)
{
    private readonly TrackMyCarOptions _options = options.Value;

    public async Task EnsureRangeAsync(string? deviceId, DateTimeOffset fromUtc,
        DateTimeOffset toUtc, CancellationToken cancellationToken)
    {
        if (!_options.Enabled || string.IsNullOrWhiteSpace(_options.ApiKey) ||
            string.IsNullOrWhiteSpace(deviceId) || deviceId.Any(character => !char.IsDigit(character)) ||
            toUtc <= fromUtc || toUtc - fromUtc > TimeSpan.FromDays(30)) return;

        var tolerance = TimeSpan.FromSeconds(Math.Max(30, _options.PollIntervalSeconds * 3));
        var coverage = await db.GpsTelemetry.AsNoTracking()
            .Where(item => item.DeviceId == deviceId && item.RecordedAtUtc >= fromUtc && item.RecordedAtUtc <= toUtc)
            .GroupBy(_ => 1)
            .Select(group => new { Count = group.Count(), First = group.Min(item => item.RecordedAtUtc), Last = group.Max(item => item.RecordedAtUtc) })
            .SingleOrDefaultAsync(cancellationToken);
        if (coverage is { Count: >= 2 } && coverage.First <= fromUtc + tolerance &&
            (coverage.Last >= toUtc - tolerance || toUtc >= timeProvider.GetUtcNow() - tolerance)) return;

        var cacheKey = $"trackmycar-history:{deviceId}:{fromUtc.UtcTicks / TimeSpan.TicksPerHour}:{toUtc.UtcTicks / TimeSpan.TicksPerHour}";
        if (cache.TryGetValue(cacheKey, out _)) return;
        cache.Set(cacheKey, true, TimeSpan.FromMinutes(5));

        try
        {
            var batch = await provider.GetMessagesAsync(deviceId, fromUtc, toUtc, cancellationToken);
            await ingestor.IngestAsync(batch.Locations, timeProvider.GetUtcNow(), cancellationToken);
        }
        catch (GpsProviderException exception)
        {
            logger.LogWarning("TrackMyCar history synchronization failed. Category: {Category}.", exception.Category);
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("TrackMyCar history synchronization failed. Category: internal-error.");
        }
    }
}

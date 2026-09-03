using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using WhaleWatching.Api.Operations;
using WhaleWatching.Api.Realtime;

namespace WhaleWatching.Api.Gps;

public sealed class TrackMyCarSyncWorker(
    IGpsProvider provider,
    IServiceScopeFactory scopeFactory,
    IHubContext<OperationsHub> hub,
    IOptions<TrackMyCarOptions> options,
    TrackMyCarSyncState syncState,
    GpsTrackerStatus trackerStatus,
    TimeProvider timeProvider,
    ILogger<TrackMyCarSyncWorker> logger) : BackgroundService
{
    private readonly TrackMyCarOptions _options = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            logger.LogInformation("TrackMyCar GPS synchronization is disabled.");
            return;
        }
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            logger.LogWarning("TrackMyCar GPS synchronization is enabled but no API key is configured.");
            syncState.Failed("not-configured");
            return;
        }

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(_options.PollIntervalSeconds), timeProvider);
        do
        {
            await SynchronizeAsync(stoppingToken);
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task SynchronizeAsync(CancellationToken cancellationToken)
    {
        try
        {
            var receivedAtUtc = timeProvider.GetUtcNow();
            var batch = await provider.GetLatestLocationsAsync(cancellationToken);
            await using var scope = scopeFactory.CreateAsyncScope();
            var ingestor = scope.ServiceProvider.GetRequiredService<GpsTelemetryIngestor>();
            var result = await ingestor.IngestAsync(batch.Locations, receivedAtUtc, cancellationToken);
            var tripTracking = scope.ServiceProvider.GetRequiredService<TripTrackingService>();

            foreach (var accepted in result.Accepted)
            {
                var telemetry = accepted.Telemetry;
                var activeTrip = await tripTracking.GetActiveForBoatAsync(accepted.BoatId, cancellationToken);
                await hub.Clients.All.SendAsync("gpsTelemetryUpdated", new
                {
                    boatId = accepted.BoatId,
                    latitude = telemetry.Latitude,
                    longitude = telemetry.Longitude,
                    speedKnots = telemetry.SpeedKnots,
                    headingDegrees = telemetry.HeadingDegrees,
                    altitudeMeters = telemetry.AltitudeMeters,
                    recordedAtUtc = telemetry.RecordedAtUtc,
                    receivedAtUtc = telemetry.ReceivedAtUtc,
                    trackerStatus = trackerStatus.Classify(telemetry.RecordedAtUtc),
                    activeTripId = activeTrip?.TripId,
                    activeTripStartedAtUtc = activeTrip?.StartedAtUtc,
                    activeTripStatus = activeTrip?.Status,
                    stops = activeTrip?.Stops.Select(stop => new
                    {
                        startedAtUtc = stop.StartedAtUtc,
                        endedAtUtc = stop.EndedAtUtc,
                        durationSeconds = stop.DurationSeconds,
                        latitude = stop.Latitude,
                        longitude = stop.Longitude,
                        isOngoing = stop.IsOngoing
                    }).ToList()
                }, cancellationToken);
            }

            syncState.Succeeded(receivedAtUtc);
            logger.LogInformation(
                "TrackMyCar GPS synchronization succeeded. Devices returned: {DeviceCount}; new records: {NewCount}; duplicates: {DuplicateCount}; invalid: {InvalidCount}; unknown devices: {UnknownCount}.",
                batch.RecordsReturned, result.Accepted.Count, result.DuplicateCount,
                batch.InvalidRecords, result.UnknownDeviceCount);
        }
        catch (GpsProviderException exception)
        {
            syncState.Failed(exception.Category);
            logger.LogWarning("TrackMyCar GPS synchronization failed. Category: {Category}.", exception.Category);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception)
        {
            syncState.Failed("internal-error");
            logger.LogError("TrackMyCar GPS synchronization failed. Category: internal-error.");
        }
    }
}

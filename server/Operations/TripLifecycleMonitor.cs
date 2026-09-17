using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Operations;

internal sealed class TripLifecycleMonitor(
    IServiceScopeFactory scopeFactory,
    ILogger<TripLifecycleMonitor> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(CheckInterval);
        do
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<WhaleWatchingDbContext>();
                var cutoff = DateTimeOffset.UtcNow.AddMinutes(-30);
                await db.Trips.Where(x =>
                        (x.Status == TripStatus.Scheduled || x.Status == TripStatus.Boarding) &&
                        x.ScheduledDepartureUtc <= cutoff)
                    .ExecuteUpdateAsync(updates => updates
                        .SetProperty(x => x.Status, TripStatus.NeedsReschedule)
                        .SetProperty(x => x.UpdatedAtUtc, DateTimeOffset.UtcNow), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Unable to update overdue trip lifecycle states.");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using WhaleWatching.Api.Data;

namespace WhaleWatching.Api.Health;

public sealed class DatabaseHealthCheck(
    WhaleWatchingDbContext dbContext,
    ILogger<DatabaseHealthCheck> logger) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await dbContext.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy("SQL Server is reachable.")
                : HealthCheckResult.Unhealthy("SQL Server is unreachable.");
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "SQL Server health check failed.");
            return HealthCheckResult.Unhealthy(
                "SQL Server health check failed.", exception);
        }
    }
}

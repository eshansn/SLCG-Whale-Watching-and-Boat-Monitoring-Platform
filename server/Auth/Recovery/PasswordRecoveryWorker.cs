using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WhaleWatching.Api.Data;

namespace WhaleWatching.Api.Auth.Recovery;

public sealed class PasswordRecoveryDeliveryProcessor(
    WhaleWatchingDbContext db, RecoverySecrets secrets, IRecoveryEmailSender sender,
    TimeProvider clock, ILogger<PasswordRecoveryDeliveryProcessor> logger)
{
    public async Task ProcessAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        await db.PasswordRecoveryDeliveries.Where(x => x.CompletedAt == null && x.Recovery.CodeExpiresAt <= now)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ProtectedCode, (string?)null).SetProperty(x => x.CompletedAt, now), ct);
        var ids = await db.PasswordRecoveryDeliveries.AsNoTracking()
            .Where(x => x.CompletedAt == null && x.NextAttemptAt <= now && (x.LeaseUntil == null || x.LeaseUntil <= now))
            .OrderBy(x => x.CreatedAt).Select(x => x.Id).Take(10).ToListAsync(ct);
        foreach (var id in ids)
        {
            ct.ThrowIfCancellationRequested();
            now = clock.GetUtcNow();
            var lease = Guid.NewGuid();
            if (await db.PasswordRecoveryDeliveries.Where(x => x.Id == id && x.CompletedAt == null && (x.LeaseUntil == null || x.LeaseUntil <= now))
                    .ExecuteUpdateAsync(s => s.SetProperty(x => x.LeaseId, lease).SetProperty(x => x.LeaseUntil, now.AddSeconds(90))
                        .SetProperty(x => x.Attempts, x => x.Attempts + 1), ct) != 1) continue;
            var delivery = await db.PasswordRecoveryDeliveries.AsNoTracking().Include(x => x.Recovery).SingleAsync(x => x.Id == id, ct);
            var recovery = delivery.Recovery;
            var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == recovery.UserId, ct);
            var valid = recovery.CancelledAt == null && recovery.VerifiedAt == null && recovery.ConsumedAt == null &&
                recovery.CodeExpiresAt > now && recovery.CodeVersion == delivery.CodeVersion && delivery.ProtectedCode != null &&
                user is { EmailConfirmed: true, PasswordHash: not null, Email: not null } &&
                RecoverySecrets.Equal(recovery.AccountStateHash, secrets.State(user));
            var delivered = false;
            var retry = false;
            if (valid)
            {
                try
                {
                    var code = secrets.Unprotect(recovery, delivery.ProtectedCode!);
                    if (!RecoverySecrets.Equal(recovery.CodeHash, secrets.CodeHash(recovery, code)))
                        throw new System.Security.Cryptography.CryptographicException();
                    await sender.SendAsync(user!.Email!, code, recovery.CodeExpiresAt, ct);
                    delivered = true;
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
                catch (Exception)
                {
                    retry = delivery.Attempts < 3 && recovery.CodeExpiresAt > clock.GetUtcNow().AddMinutes(1);
                    logger.LogWarning("A recovery email delivery attempt failed; retry scheduled: {Retry}.", retry);
                }
            }
            await db.PasswordRecoveryDeliveries.Where(x => x.Id == id && x.LeaseId == lease && x.CompletedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Delivered, delivered)
                    .SetProperty(x => x.CompletedAt, retry ? (DateTimeOffset?)null : clock.GetUtcNow())
                    .SetProperty(x => x.ProtectedCode, retry ? delivery.ProtectedCode : null)
                    .SetProperty(x => x.NextAttemptAt, clock.GetUtcNow().AddSeconds(60 * delivery.Attempts))
                    .SetProperty(x => x.LeaseId, (Guid?)null).SetProperty(x => x.LeaseUntil, (DateTimeOffset?)null), ct);
        }
        // Retain at least one day so the hourly and fifteen minute limits survive cleanup.
        var cutoff = clock.GetUtcNow().AddDays(-1);
        await db.PasswordRecoveries.Where(x => x.CreatedAt < cutoff).ExecuteDeleteAsync(ct);
        await db.PasswordRecoveryRateWindows.Where(x => x.ExpiresAt < cutoff).ExecuteDeleteAsync(ct);
    }
}

public sealed class PasswordRecoveryWorker(IServiceScopeFactory scopes, IOptions<PasswordRecoveryOptions> options,
    ILogger<PasswordRecoveryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled) return;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<PasswordRecoveryDeliveryProcessor>().ProcessAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception) { logger.LogWarning("Password recovery email processing is temporarily unavailable."); }
            await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
        }
    }
}

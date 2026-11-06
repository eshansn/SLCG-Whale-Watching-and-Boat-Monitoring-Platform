using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Contact;
using WhaleWatching.Api.Data;

namespace WhaleWatching.Api.Support;

/// <summary>Database-backed notification outbox; the saved request is authoritative.</summary>
public sealed class SupportNotificationDispatcher(WhaleWatchingDbContext db, IContactEmailSender mail,
    TimeProvider clock, ILogger<SupportNotificationDispatcher> logger)
{
    public async Task<bool> DispatchNextAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var id = await db.SupportRequests.AsNoTracking().Where(x => x.NotifiedAtUtc == null &&
            x.NextNotificationAtUtc <= now && (x.NotificationLeaseUntilUtc == null || x.NotificationLeaseUntilUtc <= now))
            .OrderBy(x => x.NextNotificationAtUtc).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (id is null) return false;
        var lease = Guid.NewGuid();
        var claimed = await db.SupportRequests.Where(x => x.Id == id && x.NotifiedAtUtc == null &&
            x.NextNotificationAtUtc <= now && (x.NotificationLeaseUntilUtc == null || x.NotificationLeaseUntilUtc <= now))
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.NotificationLeaseId, lease)
                .SetProperty(x => x.NotificationLeaseUntilUtc, now.AddMinutes(2))
                .SetProperty(x => x.NotificationAttempts, x => x.NotificationAttempts + 1), ct);
        if (claimed == 0) return true;
        var ticket = await db.SupportRequests.AsNoTracking().SingleAsync(x => x.Id == id, ct);
        try
        {
            // Reuse the existing themed email, SMTP settings and configured Contact recipient.
            var body = $"SUPPORT REQUEST {ticket.Id}\nReceived: {ticket.CreatedAtUtc:O}\nPortal: {ticket.Portal}\n" +
                $"Subject: {ticket.Subject}\nCategory: {ticket.Category}\n\n{ticket.Message}";
            await mail.SendSupportAsync(new ContactRequest(ticket.FullName, ticket.Email, body), ticket.Id, ticket.Subject, ct);
            await db.SupportRequests.Where(x => x.Id == id && x.NotificationLeaseId == lease)
                .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.NotifiedAtUtc, clock.GetUtcNow())
                    .SetProperty(x => x.NotificationLeaseId, (Guid?)null).SetProperty(x => x.NotificationLeaseUntilUtc, (DateTimeOffset?)null), ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception)
        {
            // Never log SMTP credentials, addresses or the user's issue description.
            logger.LogWarning("Support notification {RequestId} remains queued for retry.", ticket.Id);
            var retry = clock.GetUtcNow().AddMinutes(Math.Min(360, Math.Pow(2, Math.Min(ticket.NotificationAttempts, 9))));
            await db.SupportRequests.Where(x => x.Id == id && x.NotificationLeaseId == lease)
                .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.NextNotificationAtUtc, retry)
                    .SetProperty(x => x.NotificationLeaseId, (Guid?)null).SetProperty(x => x.NotificationLeaseUntilUtc, (DateTimeOffset?)null), ct);
        }
        return true;
    }
}

public sealed class SupportNotificationWorker(IServiceScopeFactory scopes, ILogger<SupportNotificationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                for (var i = 0; i < 5; i++)
                {
                    await using var scope = scopes.CreateAsyncScope();
                    if (!await scope.ServiceProvider.GetRequiredService<SupportNotificationDispatcher>().DispatchNextAsync(stoppingToken)) break;
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception) { logger.LogWarning("Support notification processing is temporarily unavailable."); }
            try { await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}

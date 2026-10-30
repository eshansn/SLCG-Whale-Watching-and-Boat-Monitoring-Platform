using System.Data;
using System.Net.Mail;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Auth.Recovery;

public sealed record RecoveryResult(int Status, object Body, bool Commit = true);
public sealed record RecoveryAccepted(Guid RecoveryId, int ExpiresInSeconds, int ResendAfterSeconds, string Message);
public sealed record RecoveryVerified(string ResetAuthorization, int ExpiresInSeconds);

public sealed class PasswordRecoveryService(
    WhaleWatchingDbContext db, UserManager<ApplicationUser> users, RecoverySecrets secrets,
    IOptions<PasswordRecoveryOptions> settings, TimeProvider clock)
{
    private PasswordRecoveryOptions Options => settings.Value;
    public static RecoveryResult Invalid() => new(400, new { message = "The code or recovery authorization is invalid, expired, or no longer available. Start a new request if needed." });
    private static RecoveryResult Limited() => new(429, new { message = "Too many recovery requests. Please wait before trying again.", retryAfterSeconds = 60 });
    private static RecoveryResult Disabled() => new(503, new { message = "Password recovery is temporarily unavailable. Please try again later." });

    // Application locks are transaction-owned and shared by every API instance using this database.
    public static Task LockAsync(WhaleWatchingDbContext db, string resource, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync($@"DECLARE @result int;
            EXEC @result = sys.sp_getapplock @Resource={resource}, @LockMode='Exclusive',
                @LockOwner='Transaction', @LockTimeout=5000;
            IF @result < 0 THROW 51000, 'Recovery request is busy.', 1;", ct);

    private async Task<bool> AllowIpAsync(string ip, CancellationToken ct)
    {
        return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            var now = clock.GetUtcNow();
            var minute = now.ToUnixTimeSeconds() / 60;
            var key = secrets.Hash("ip-window", $"{ip}\n{minute}");
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
            await LockAsync(db, "recovery-ip:" + key, ct);
            var window = await db.PasswordRecoveryRateWindows.FindAsync([key], ct);
            if (window is null)
            {
                window = new() { Id = key, ExpiresAt = DateTimeOffset.FromUnixTimeSeconds((minute + 1) * 60) };
                db.PasswordRecoveryRateWindows.Add(window);
            }
            if (window.Requests >= Options.RequestsPerIpPerMinute) return false;
            window.Requests++;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return true;
        });
    }

    public async Task<RecoveryResult> StartAsync(string email, string ip, CancellationToken ct)
    {
        if (!Options.Enabled) return Disabled();
        if (!await AllowIpAsync(ip, ct)) return Limited();
        var normalized = users.NormalizeEmail(email.Trim());
        var key = secrets.Hash("account", normalized ?? "");
        return await WithAccountAsync(key, async () =>
        {
            var now = clock.GetUtcNow();
            if (await db.PasswordRecoveries.CountAsync(x => x.AccountKey == key && x.CreatedAt > now.AddHours(-1), ct) >= Options.RequestsPerHour ||
                !await CanSendAsync(key, now, ct)) return Limited();
            var user = await users.FindByEmailAsync(email.Trim());
            // Decoy transactions follow the same public workflow and limits, but can never authorize a reset.
            var eligible = Eligible(user);
            await InvalidateAccountAsync(key, now, ct);
            var recovery = new PasswordRecovery
            {
                Id = Guid.NewGuid(), UserId = eligible ? user!.Id : null, AccountKey = key,
                AccountStateHash = eligible ? secrets.State(user!) : secrets.Hash("decoy", Guid.NewGuid().ToString()),
                CreatedAt = now
            };
            db.PasswordRecoveries.Add(recovery);
            IssueCode(recovery, now);
            return Accepted(recovery);
        }, ct);
    }

    public async Task<RecoveryResult> ResendAsync(Guid recoveryId, string ip, CancellationToken ct)
    {
        if (!Options.Enabled) return Disabled();
        if (!await AllowIpAsync(ip, ct)) return Limited();
        return await WithRecoveryAsync(recoveryId, async recovery =>
        {
            var now = clock.GetUtcNow();
            if (recovery.CancelledAt is not null || recovery.ConsumedAt is not null || recovery.VerifiedAt is not null ||
                recovery.FailedAttempts >= 5 || recovery.CreatedAt <= now.AddHours(-1)) return Invalid();
            if (!await CanSendAsync(recovery.AccountKey, now, ct)) return Limited();
            await ClearDeliveriesAsync(recovery.Id, now, ct);
            IssueCode(recovery, now);
            return Accepted(recovery);
        }, ct);
    }

    public async Task<RecoveryResult> VerifyAsync(Guid recoveryId, string code, string ip, CancellationToken ct)
    {
        if (!Options.Enabled) return Disabled();
        if (!await AllowIpAsync(ip, ct)) return Limited();
        return await WithRecoveryAsync(recoveryId, async recovery =>
        {
            var now = clock.GetUtcNow();
            if (recovery.CancelledAt is not null || recovery.ConsumedAt is not null || recovery.VerifiedAt is not null ||
                recovery.CodeExpiresAt <= now || recovery.FailedAttempts >= 5) return Invalid();
            var user = recovery.UserId.HasValue ? await users.FindByIdAsync(recovery.UserId.Value.ToString()) : null;
            var codeMatches = RecoverySecrets.Equal(recovery.CodeHash, secrets.CodeHash(recovery, code));
            if (!codeMatches || !Eligible(user) || !RecoverySecrets.Equal(recovery.AccountStateHash, user is null ? "" : secrets.State(user)))
            {
                recovery.FailedAttempts++;
                if (recovery.FailedAttempts >= 5)
                {
                    recovery.CancelledAt = now;
                    await ClearDeliveriesAsync(recovery.Id, now, ct);
                }
                return Invalid();
            }
            var authorization = RecoverySecrets.NewAuthorization();
            recovery.VerifiedAt = now;
            recovery.AuthorizationHash = secrets.AuthorizationHash(recovery, authorization);
            recovery.AuthorizationExpiresAt = now.AddMinutes(5);
            await ClearDeliveriesAsync(recovery.Id, now, ct);
            return new(200, new RecoveryVerified(authorization, 300));
        }, ct);
    }

    public async Task<RecoveryResult> ResetAsync(Guid recoveryId, string authorization, string password, string confirmation, string ip, CancellationToken ct)
    {
        if (!Options.Enabled) return Disabled();
        if (!await AllowIpAsync(ip, ct)) return Limited();
        return await WithRecoveryAsync(recoveryId, async recovery =>
        {
            var now = clock.GetUtcNow();
            var hash = secrets.AuthorizationHash(recovery, authorization);
            if (recovery.CancelledAt is not null || recovery.ConsumedAt is not null || recovery.VerifiedAt is null ||
                recovery.AuthorizationExpiresAt is null || recovery.AuthorizationExpiresAt <= now ||
                !RecoverySecrets.Equal(recovery.AuthorizationHash, hash) || !recovery.UserId.HasValue)
                return Invalid();
            var user = await users.FindByIdAsync(recovery.UserId.Value.ToString());
            if (!Eligible(user) || !RecoverySecrets.Equal(recovery.AccountStateHash, user is null ? "" : secrets.State(user))) return Invalid();
            if (password != confirmation) return new(400, new { message = "Passwords do not match." });

            // Identity updates the password hash and security stamp. Both saves share this SQL transaction.
            var identityToken = await users.GeneratePasswordResetTokenAsync(user!);
            var result = await users.ResetPasswordAsync(user!, identityToken, password);
            if (!result.Succeeded)
            {
                // Only password policy details are public; no account or provider state is returned.
                var policyErrors = result.Errors.Where(x => x.Code.StartsWith("Password", StringComparison.Ordinal))
                    .Select(x => x.Description).ToArray();
                return new(400, new { message = policyErrors.Length > 0 ? string.Join(" ", policyErrors) : "Unable to reset the password. Start a new recovery request." }, false);
            }
            user!.PasswordResetAtUtc = now;
            recovery.ConsumedAt = now;
            recovery.AuthorizationHash = null;
            await InvalidateAccountAsync(recovery.AccountKey, now, ct);
            await db.RefreshTokens.Where(x => x.UserId == user.Id && x.RevokedAtUtc == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.RevokedAtUtc, now)
                    .SetProperty(x => x.RevocationReason, "Password recovery"), ct);
            return new(200, new { message = "Your password has been reset. Sign in with your new password." });
        }, ct);
    }

    private static bool Eligible(ApplicationUser? user) => user is { EmailConfirmed: true, PasswordHash: not null } &&
        !string.IsNullOrWhiteSpace(user.SecurityStamp) && MailAddress.TryCreate(user.Email, out _);

    private async Task<bool> CanSendAsync(string key, DateTimeOffset now, CancellationToken ct) =>
        !await db.PasswordRecoveryDeliveries.AnyAsync(x => x.AccountKey == key && x.CreatedAt > now.AddSeconds(-Options.ResendSeconds), ct) &&
        await db.PasswordRecoveryDeliveries.CountAsync(x => x.AccountKey == key && x.CreatedAt > now.AddMinutes(-15), ct) < Options.SendsPer15Minutes;

    private void IssueCode(PasswordRecovery recovery, DateTimeOffset now)
    {
        var code = RecoverySecrets.NewCode();
        // Ensure a replacement never accidentally repeats the immediately previous numeric code.
        while (RecoverySecrets.Equal(recovery.CodeHash, secrets.CodeHash(recovery, code))) code = RecoverySecrets.NewCode();
        recovery.CodeVersion = Guid.NewGuid();
        recovery.CodeHash = secrets.CodeHash(recovery, code);
        recovery.CodeIssuedAt = now;
        recovery.CodeExpiresAt = now.AddMinutes(10);
        db.PasswordRecoveryDeliveries.Add(new()
        {
            Id = Guid.NewGuid(), RecoveryId = recovery.Id, AccountKey = recovery.AccountKey,
            CodeVersion = recovery.CodeVersion, CreatedAt = now, NextAttemptAt = now,
            ProtectedCode = secrets.Protect(recovery, code)
        });
    }

    private RecoveryResult Accepted(PasswordRecovery recovery) => new(202, new RecoveryAccepted(recovery.Id, 600, Options.ResendSeconds,
        "If the account is eligible, your recovery request has been accepted for processing. Check your registered email; delivery may take a few minutes."));

    private Task ClearDeliveriesAsync(Guid id, DateTimeOffset now, CancellationToken ct) =>
        db.PasswordRecoveryDeliveries.Where(x => x.RecoveryId == id && x.CompletedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ProtectedCode, (string?)null).SetProperty(x => x.CompletedAt, now), ct);

    private async Task InvalidateAccountAsync(string key, DateTimeOffset now, CancellationToken ct)
    {
        await db.PasswordRecoveries.Where(x => x.AccountKey == key && x.CancelledAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.CancelledAt, now).SetProperty(x => x.AuthorizationHash, (string?)null), ct);
        await db.PasswordRecoveryDeliveries.Where(x => x.AccountKey == key && x.CompletedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ProtectedCode, (string?)null).SetProperty(x => x.CompletedAt, now), ct);
    }

    private async Task<RecoveryResult> WithRecoveryAsync(Guid id, Func<PasswordRecovery, Task<RecoveryResult>> action, CancellationToken ct)
    {
        var key = await db.PasswordRecoveries.AsNoTracking().Where(x => x.Id == id).Select(x => x.AccountKey).SingleOrDefaultAsync(ct);
        if (key is null) return Invalid();
        return await WithAccountAsync(key, async () =>
        {
            var recovery = await db.PasswordRecoveries.SingleOrDefaultAsync(x => x.Id == id, ct);
            return recovery is null ? Invalid() : await action(recovery);
        }, ct);
    }

    private async Task<RecoveryResult> WithAccountAsync(string key, Func<Task<RecoveryResult>> action, CancellationToken ct) =>
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
            await LockAsync(db, "recovery-account:" + key, ct);
            var result = await action();
            if (!result.Commit) return result;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return result;
        });
}

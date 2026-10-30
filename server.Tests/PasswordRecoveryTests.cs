using System.Collections.Concurrent;
using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Auth.Recovery;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Tests;

public sealed class PasswordRecoveryTests
{
    private const string OldPassword = "BeforeReset#2026!Test";
    private const string NewPassword = "AfterReset#2026!Test";

    [Fact]
    public void Configuration_RequiresSecretAndGmailStartTlsSettingsWhenEnabled()
    {
        Assert.True(new PasswordRecoveryOptions().IsValid());
        var options = TestOptions();
        Assert.True(options.IsValid());
        options.HashKey = "not-base64"; Assert.False(options.IsValid());
        options = TestOptions(); options.HashKey = Convert.ToBase64String(new byte[16]); Assert.False(options.IsValid());
        options = TestOptions(); options.Smtp.Port = 25; Assert.False(options.IsValid());
        options = TestOptions(); options.Smtp.Host = "untrusted.example"; Assert.False(options.IsValid());
        options = TestOptions(); options.Smtp.AppPassword = ""; Assert.False(options.IsValid());
        options = TestOptions(); options.Smtp.FromEmail = "invalid"; Assert.False(options.IsValid());
    }

    [Fact]
    public void Codes_AreExactlySixDecimalDigits_AndProtectedHashesAreContextBound()
    {
        for (var i = 0; i < 1000; i++) Assert.Matches("^[0-9]{6}$", RecoverySecrets.NewCode());
        using var services = new ServiceCollection().AddDataProtection().Services.BuildServiceProvider();
        var secrets = new RecoverySecrets(Options.Create(TestOptions()), services.GetRequiredService<Microsoft.AspNetCore.DataProtection.IDataProtectionProvider>());
        var first = new PasswordRecovery { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), CodeVersion = Guid.NewGuid() };
        var second = new PasswordRecovery { Id = Guid.NewGuid(), UserId = first.UserId, CodeVersion = first.CodeVersion };
        Assert.NotEqual(secrets.CodeHash(first, "000001"), secrets.CodeHash(second, "000001"));
        Assert.Equal("000001", secrets.Unprotect(first, secrets.Protect(first, "000001")));
        Assert.Throws<CryptographicException>(() => secrets.Unprotect(second, secrets.Protect(first, "000001")));
        Assert.Equal(43, RecoverySecrets.NewAuthorization().Length);
    }

    [SqlServerFact]
    public async Task EveryExistingRole_RecoversAndLogsIn_WithRolesPreservedAndOldSessionsRevoked()
    {
        await using var test = await Harness.CreateAsync();
        foreach (var role in PortalRoles.All)
        {
            test.Clock.Advance(TimeSpan.FromMinutes(1));
            var email = Email(role);
            var before = await test.Login(email, OldPassword);
            var oldAccess = before.GetProperty("accessToken").GetString()!;
            var oldRefresh = before.GetProperty("refreshToken").GetString()!;
            var id = await test.Start(email);
            var code = await test.Deliver(id);
            var grant = await test.Verify(id, code);
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Reset(id, grant, "weak", "weak")).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Reset(id, grant, NewPassword, "does-not-match")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await test.Reset(id, grant)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Reset(id, grant)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("verify-reset-otp", new { recoveryId = id, code })).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await test.Post("login", new { email, password = OldPassword })).StatusCode);
            var after = await test.Login(email, NewPassword);
            Assert.Equal(new[] { role }, after.GetProperty("roles").EnumerateArray().Select(x => x.GetString()).ToArray());
            Assert.Equal(HttpStatusCode.Unauthorized, (await test.Post("refresh", new { refreshToken = oldRefresh })).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await test.Protected(oldAccess, role)).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await test.Protected(test.LegacyToken(role), role)).StatusCode);
            var access = after.GetProperty("accessToken").GetString()!;
            Assert.Equal(HttpStatusCode.OK, (await test.Protected(access, role)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await test.Protected(access, role == PortalRoles.Admin ? PortalRoles.Ops : PortalRoles.Admin)).StatusCode);
        }
    }

    [SqlServerFact]
    public async Task Codes_RejectWrongAccountTransactionReplayAndExpiredOtp()
    {
        await using var test = await Harness.CreateAsync();
        var first = await test.Start(Email(PortalRoles.Admin));
        var firstCode = await test.Deliver(first);
        var other = await test.Start(Email(PortalRoles.Ops));
        var otherCode = await test.Deliver(other);
        // Distinct generated codes are required for an unambiguous cross-account test.
        if (otherCode == firstCode) { test.Clock.Advance(TimeSpan.FromMinutes(1)); await test.Post("resend-reset-otp", new { recoveryId = other }); otherCode = await test.Deliver(other); }
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("verify-reset-otp", new { recoveryId = other, code = firstCode })).StatusCode);
        var grant = await test.Verify(first, firstCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Reset(other, grant)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("verify-reset-otp", new { recoveryId = first, code = firstCode })).StatusCode);
        test.Clock.Advance(TimeSpan.FromMinutes(11));
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("verify-reset-otp", new { recoveryId = other, code = otherCode })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Reset(first, grant)).StatusCode);
        var replacement = await test.Start(Email(PortalRoles.Admin));
        var newCode = await test.Deliver(replacement);
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("verify-reset-otp", new { recoveryId = first, code = newCode })).StatusCode);
        await test.Verify(replacement, newCode);
    }

    [SqlServerFact]
    public async Task FiveWrongAttempts_InvalidateTransactionAndCannotBeBypassedByResending()
    {
        await using var test = await Harness.CreateAsync();
        var id = await test.Start(Email(PortalRoles.Admin)); var code = await test.Deliver(id);
        var wrong = code == "000000" ? "000001" : "000000";
        for (var i = 0; i < 5; i++) Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("verify-reset-otp", new { recoveryId = id, code = wrong })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("verify-reset-otp", new { recoveryId = id, code })).StatusCode);
        test.Clock.Advance(TimeSpan.FromMinutes(1));
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("resend-reset-otp", new { recoveryId = id })).StatusCode);
        var row = await test.Db.PasswordRecoveries.AsNoTracking().SingleAsync(x => x.Id == id);
        Assert.Equal(5, row.FailedAttempts); Assert.NotNull(row.CancelledAt);
    }

    [SqlServerFact]
    public async Task Resend_IsAccountLimitedAndReplacesThePreviousCode()
    {
        await using var test = await Harness.CreateAsync();
        var email = Email(PortalRoles.Admin);
        var id = await test.Start(email); var oldCode = await test.Deliver(id);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await test.Post("resend-reset-otp", new { recoveryId = id })).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await test.Post("forgot-password", new { email })).StatusCode);
        test.Clock.Advance(TimeSpan.FromSeconds(60));
        Assert.Equal(HttpStatusCode.Accepted, (await test.Post("resend-reset-otp", new { recoveryId = id })).StatusCode);
        var current = await test.Deliver(id); Assert.NotEqual(oldCode, current);
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("verify-reset-otp", new { recoveryId = id, code = oldCode })).StatusCode);
        test.Clock.Advance(TimeSpan.FromSeconds(60));
        Assert.Equal(HttpStatusCode.Accepted, (await test.Post("resend-reset-otp", new { recoveryId = id })).StatusCode);
        test.Clock.Advance(TimeSpan.FromSeconds(60));
        Assert.Equal(HttpStatusCode.TooManyRequests, (await test.Post("resend-reset-otp", new { recoveryId = id })).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await test.Post("forgot-password", new { email })).StatusCode);
    }

    [SqlServerFact]
    public async Task HourlyAndIpLimits_ArePersistedAcrossIndependentServiceScopes()
    {
        await using var test = await Harness.CreateAsync();
        var email = Email(PortalRoles.Ops);
        for (var i = 0; i < 5; i++)
        {
            await test.Start(email);
            if (i < 4) test.Clock.Advance(TimeSpan.FromMinutes(12));
        }
        await using (var scope = test.App.Services.CreateAsyncScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<PasswordRecoveryService>();
            Assert.Equal(429, (await service.StartAsync(email, "other-instance-ip", default)).Status);
        }
        test.Clock.Advance(TimeSpan.FromMinutes(1));
        test.Settings.RequestsPerIpPerMinute = 2;
        await using (var first = test.App.Services.CreateAsyncScope())
            Assert.Equal(202, (await first.ServiceProvider.GetRequiredService<PasswordRecoveryService>().StartAsync("unknown1@example.test", "shared-ip", default)).Status);
        await using (var second = test.App.Services.CreateAsyncScope())
            Assert.Equal(400, (await second.ServiceProvider.GetRequiredService<PasswordRecoveryService>().VerifyAsync(Guid.NewGuid(), "123456", "shared-ip", default)).Status);
        await using (var third = test.App.Services.CreateAsyncScope())
            Assert.Equal(429, (await third.ServiceProvider.GetRequiredService<PasswordRecoveryService>().StartAsync("unknown2@example.test", "shared-ip", default)).Status);
    }

    [SqlServerFact]
    public async Task ConcurrentVerifyAndReset_OnlyOneRequestCanConsumeEachAuthorization()
    {
        await using var test = await Harness.CreateAsync();
        var id = await test.Start(Email(PortalRoles.Admin)); var code = await test.Deliver(id);
        var verified = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => test.Post("verify-reset-otp", new { recoveryId = id, code })));
        Assert.Single(verified, x => x.StatusCode == HttpStatusCode.OK);
        Assert.Equal(3, verified.Count(x => x.StatusCode == HttpStatusCode.BadRequest));
        var grant = (await verified.Single(x => x.IsSuccessStatusCode).Content.ReadFromJsonAsync<RecoveryVerified>())!.ResetAuthorization;
        var reset = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => test.Reset(id, grant)));
        Assert.Single(reset, x => x.StatusCode == HttpStatusCode.OK);
        Assert.Equal(3, reset.Count(x => x.StatusCode == HttpStatusCode.BadRequest));
        await test.Login(Email(PortalRoles.Admin), NewPassword);
    }

    [SqlServerFact]
    public async Task FailedFinalSave_RollsBackPasswordConsumptionAndSessionRevocation()
    {
        await using var test = await Harness.CreateAsync();
        var email = Email(PortalRoles.Admin); var login = await test.Login(email, OldPassword);
        var id = await test.Start(email); var grant = await test.Verify(id, await test.Deliver(id));
        test.Failure.FailFinalResetSave = true;
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await test.Reset(id, grant)).StatusCode);
        await test.Login(email, OldPassword);
        var row = await test.Db.PasswordRecoveries.AsNoTracking().SingleAsync(x => x.Id == id);
        Assert.Null(row.ConsumedAt); Assert.NotNull(row.AuthorizationHash);
        var refresh = await test.Post("refresh", new { refreshToken = login.GetProperty("refreshToken").GetString() });
        Assert.Equal(HttpStatusCode.OK, refresh.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await test.Reset(id, grant)).StatusCode);
    }

    [SqlServerFact]
    public async Task AccountStateChangesAndNewRequests_InvalidateOutstandingAuthorizations()
    {
        await using var test = await Harness.CreateAsync();
        var email = Email(PortalRoles.Admin); var id = await test.Start(email);
        var grant = await test.Verify(id, await test.Deliver(id));
        test.Clock.Advance(TimeSpan.FromSeconds(60));
        var next = await test.Start(email); var nextCode = await test.Deliver(next);
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Reset(id, grant)).StatusCode);
        await test.Db.Users.Where(x => x.Email == email).ExecuteUpdateAsync(s => s.SetProperty(x => x.EmailConfirmed, false));
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("verify-reset-otp", new { recoveryId = next, code = nextCode })).StatusCode);
        var second = await test.Start(Email(PortalRoles.Ops)); var secondGrant = await test.Verify(second, await test.Deliver(second));
        await test.Db.Users.Where(x => x.Email == Email(PortalRoles.Ops)).ExecuteUpdateAsync(s => s.SetProperty(x => x.SecurityStamp, Guid.NewGuid().ToString()));
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Reset(second, secondGrant)).StatusCode);
    }

    [SqlServerFact]
    public async Task Authorizations_CannotBeSwappedTamperedOrValidatedWithAnotherServerKey()
    {
        await using var test = await Harness.CreateAsync();
        var first = await test.Start(Email(PortalRoles.Admin)); var code = await test.Deliver(first);
        var firstGrant = await test.Verify(first, code);
        var other = await test.Start(Email(PortalRoles.Ops)); var otherGrant = await test.Verify(other, await test.Deliver(other));
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Reset(first, otherGrant)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Reset(other, firstGrant)).StatusCode);
        var tampered = (firstGrant[0] == 'A' ? "B" : "A") + firstGrant[1..];
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Reset(first, tampered)).StatusCode);
        var originalKey = test.Settings.HashKey;
        test.Settings.HashKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Reset(first, firstGrant)).StatusCode);
        test.Settings.HashKey = originalKey;
        Assert.Equal(HttpStatusCode.OK, (await test.Reset(first, firstGrant)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await test.Reset(other, otherGrant)).StatusCode);
    }

    [SqlServerFact]
    public async Task MissingOrInvalidRegisteredEmail_CannotReceiveCodes_AndRecoveryDoesNotBypassLockout()
    {
        await using var test = await Harness.CreateAsync();
        await test.Db.Users.Where(x => x.Email == Email(PortalRoles.Admin)).ExecuteUpdateAsync(s => s.SetProperty(x => x.Email, (string?)null));
        await test.Db.Users.Where(x => x.Email == Email(PortalRoles.Ops)).ExecuteUpdateAsync(s => s.SetProperty(x => x.Email, "not-valid"));
        var missing = await test.Start(Email(PortalRoles.Admin));
        var invalid = await test.Start(Email(PortalRoles.Ops));
        await test.Process(); Assert.Empty(test.Mail.Sent);
        Assert.All(await test.Db.PasswordRecoveries.AsNoTracking().ToListAsync(), x => Assert.Null(x.UserId));
        var email = Email(PortalRoles.ShoreCrew);
        await test.Db.Users.Where(x => x.Email == email).ExecuteUpdateAsync(s => s.SetProperty(x => x.LockoutEnabled, true).SetProperty(x => x.LockoutEnd, DateTimeOffset.UtcNow.AddMinutes(15)));
        var locked = await test.Start(email); var grant = await test.Verify(locked, await test.Deliver(locked));
        Assert.Equal(HttpStatusCode.OK, (await test.Reset(locked, grant)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await test.Post("login", new { email, password = NewPassword })).StatusCode);
        Assert.True(await test.Db.Users.Where(x => x.Email == email).Select(x => x.LockoutEnd > DateTimeOffset.UtcNow).SingleAsync());
    }

    [SqlServerFact]
    public async Task PublicRequests_AreGenericForUnknownUnconfirmedAndExistingAccounts_AndUseStoredEmailOnly()
    {
        await using var test = await Harness.CreateAsync();
        await test.Db.Users.Where(x => x.Email == Email(PortalRoles.Ops)).ExecuteUpdateAsync(s => s.SetProperty(x => x.EmailConfirmed, false));
        var ids = new List<Guid>(); var responses = new List<JsonElement>();
        foreach (var email in new[] { "  " + Email(PortalRoles.Admin).ToUpperInvariant() + "  ", Email(PortalRoles.Ops), "unknown@example.test" })
        {
            var response = await test.Post("forgot-password", new { email = email.Trim(), destinationEmail = "attacker@example.test", userId = Guid.NewGuid(), role = "Admin" });
            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
            var json = await response.Content.ReadFromJsonAsync<JsonElement>(); responses.Add(json); ids.Add(json.GetProperty("recoveryId").GetGuid());
            var raw = json.ToString(); Assert.DoesNotContain("attacker", raw); Assert.DoesNotContain("Hash", raw); Assert.DoesNotContain("AppPassword", raw);
        }
        Assert.Single(responses.Select(x => x.GetProperty("message").GetString()).Distinct());
        await test.Process();
        Assert.Single(test.Mail.Sent); Assert.Equal(Email(PortalRoles.Admin), test.Mail.Sent.Single().Email);
        foreach (var id in ids.Skip(1)) Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("verify-reset-otp", new { recoveryId = id, code = "000000" })).StatusCode);
        Assert.All(await test.Db.PasswordRecoveryDeliveries.AsNoTracking().ToListAsync(), row => Assert.Null(row.ProtectedCode));
    }

    [SqlServerFact]
    public async Task SmtpFailure_IsRetriedWithoutDeliveryClaims_AndExpiredRecordsAreCleaned()
    {
        await using var test = await Harness.CreateAsync();
        test.Mail.Fail = true;
        var id = await test.Start(Email(PortalRoles.Admin));
        var queued = await test.Db.PasswordRecoveryDeliveries.AsNoTracking().SingleAsync();
        Assert.NotNull(queued.ProtectedCode); Assert.DoesNotMatch("^[0-9]{6}$", queued.ProtectedCode!);
        await test.Process();
        var first = await test.Db.PasswordRecoveryDeliveries.AsNoTracking().SingleAsync();
        Assert.False(first.Delivered); Assert.Null(first.CompletedAt); Assert.Equal(1, first.Attempts);
        test.Clock.Advance(TimeSpan.FromMinutes(1)); await test.Process();
        test.Clock.Advance(TimeSpan.FromMinutes(2)); await test.Process();
        var failed = await test.Db.PasswordRecoveryDeliveries.AsNoTracking().SingleAsync();
        Assert.False(failed.Delivered); Assert.NotNull(failed.CompletedAt); Assert.Null(failed.ProtectedCode);
        Assert.Equal(3, failed.Attempts); Assert.Empty(test.Mail.Sent);
        test.Clock.Advance(TimeSpan.FromDays(2)); await test.Process();
        Assert.Empty(await test.Db.PasswordRecoveries.ToListAsync()); Assert.Empty(await test.Db.PasswordRecoveryRateWindows.ToListAsync());
    }

    [SqlServerFact]
    public async Task Worker_LeasesPreventDuplicateDeliveryAndEncryptedPayloadTamperingIsRejected()
    {
        await using var test = await Harness.CreateAsync();
        var id = await test.Start(Email(PortalRoles.Admin));
        await Task.WhenAll(test.Process(), test.Process()); Assert.Single(test.Mail.Sent);
        var other = await test.Start(Email(PortalRoles.Ops));
        await test.Db.PasswordRecoveryDeliveries.Where(x => x.RecoveryId == other).ExecuteUpdateAsync(s => s.SetProperty(x => x.ProtectedCode, "tampered"));
        await test.Process(); Assert.Single(test.Mail.Sent);
    }

    [SqlServerFact]
    public async Task InvalidAndOversizedInputs_AreRejected_AndDisabledConfigurationIsGeneric()
    {
        await using var test = await Harness.CreateAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("forgot-password", new { email = "not-email" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("verify-reset-otp", new { recoveryId = Guid.NewGuid(), code = "12345x" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Post("reset-password", new { recoveryId = Guid.NewGuid(), resetAuthorization = "short", newPassword = NewPassword, confirmPassword = NewPassword })).StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await test.Post("forgot-password", new { email = "a@example.test", unused = new string('x', 5000) })).StatusCode);
        test.Settings.Enabled = false;
        foreach (var email in new[] { Email(PortalRoles.Admin), "unknown@example.test" })
            Assert.Equal(HttpStatusCode.ServiceUnavailable, (await test.Post("forgot-password", new { email })).StatusCode);
        Assert.Empty(await test.Db.PasswordRecoveries.ToListAsync());
    }

    [SqlServerFact]
    public async Task Migration_UpgradesExistingIdentityAccounts_AndMatchesModel()
    {
        var connection = Connection();
        await using var db = new WhaleWatchingDbContext(new DbContextOptionsBuilder<WhaleWatchingDbContext>().UseSqlServer(connection).Options);
        try
        {
            var migrations = db.Database.GetMigrations().ToArray();
            await db.GetService<IMigrator>().MigrateAsync(migrations[^2]);
            // Insert using the old table schema before the nullable user column exists.
            var id = Guid.NewGuid();
            await db.Database.ExecuteSqlInterpolatedAsync($@"INSERT INTO AspNetUsers (Id,DisplayName,Email,EmailConfirmed,PhoneNumberConfirmed,TwoFactorEnabled,LockoutEnabled,AccessFailedCount,IsCrewCertified) VALUES ({id},'Legacy account','legacy@example.test',1,0,0,1,0,0)");
            await db.Database.MigrateAsync(); await db.Database.MigrateAsync();
            Assert.False(db.Database.HasPendingModelChanges());
            var user = await db.Users.SingleAsync(x => x.Id == id); Assert.Null(user.PasswordResetAtUtc);
            Assert.Equal("legacy@example.test", user.Email);
            Assert.Empty(await db.PasswordRecoveries.ToListAsync());
        }
        finally { await db.Database.EnsureDeletedAsync(); }
    }

    [ComplaintBrowserFact]
    public async Task Browser_LivePasswordRecovery_MobileDesktopAndEnglishOnlyFlow()
        => await RunBrowserAsync("password-recovery.cjs");

    [ComplaintBrowserFact]
    public async Task Browser_LiveDeepOceanAuthentication_LoginRegistrationAndRoleRouting()
        => await RunBrowserAsync("deep-ocean-auth.cjs");

    private static async Task RunBrowserAsync(string scriptName)
    {
        await using var test = await Harness.CreateAsync(browser: true);
        var script = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../scripts/tests", scriptName));
        var start = new ProcessStartInfo("node") { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
        start.ArgumentList.Add(script); start.Environment["RECOVERY_BASE_URL"] = test.Client.BaseAddress!.ToString();
        using var process = Process.Start(start)!;
        var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        Assert.True(process.ExitCode == 0, await stdout + await stderr);
    }

    private static string Email(string role) => $"{role.ToLowerInvariant()}@recovery-test.example";
    private static string Connection() => new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("WWMS_TEST_SQL_CONNECTION"))
        { InitialCatalog = $"WWMS_RecoveryTests_{Guid.NewGuid():N}" }.ConnectionString;
    private static PasswordRecoveryOptions TestOptions() => new()
    {
        Enabled = true, HashKey = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes("Isolated test key only"))),
        Smtp = new() { Username = "test@example.test", FromEmail = "test@example.test", AppPassword = "testonlypassword" }
    };

    private sealed class ManualClock : TimeProvider
    {
        private long ticks = DateTimeOffset.UtcNow.UtcTicks;
        public override DateTimeOffset GetUtcNow() => new(Interlocked.Read(ref ticks), TimeSpan.Zero);
        public void Advance(TimeSpan amount) => Interlocked.Add(ref ticks, amount.Ticks);
    }
    private sealed record SentMail(string Email, string Code);
    private sealed class FakeMail : IRecoveryEmailSender
    {
        public bool Fail { get; set; }
        public ConcurrentQueue<SentMail> Sent { get; } = new();
        public Task SendAsync(string registeredEmail, string code, DateTimeOffset expiresAt, CancellationToken ct)
        {
            if (Fail) throw new InvalidOperationException("Simulated SMTP failure");
            Sent.Enqueue(new(registeredEmail, code)); return Task.CompletedTask;
        }
    }
    private sealed class FailureInjector : SaveChangesInterceptor
    {
        public bool FailFinalResetSave { get; set; }
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData data, InterceptionResult<int> result, CancellationToken ct = default)
        {
            if (FailFinalResetSave && data.Context!.ChangeTracker.Entries<ApplicationUser>().Any(x => x.Entity.PasswordResetAtUtc != null))
            { FailFinalResetSave = false; throw new InvalidOperationException("Simulated final save failure"); }
            return ValueTask.FromResult(result);
        }
    }

    private sealed class Harness(WebApplication app, WhaleWatchingDbContext db) : IAsyncDisposable
    {
        private const string SigningKey = "WWMS-isolated-recovery-test-only-signing-key";
        public WebApplication App => app;
        public WhaleWatchingDbContext Db => db;
        public ManualClock Clock { get; private init; } = null!;
        public FakeMail Mail { get; private init; } = null!;
        public PasswordRecoveryOptions Settings { get; private init; } = null!;
        public FailureInjector Failure { get; private init; } = null!;
        public HttpClient Client { get; private init; } = null!;
        private readonly Dictionary<string, Guid> ids = [];

        public static async Task<Harness> CreateAsync(bool browser = false)
        {
            var connection = Connection();
            var db = new WhaleWatchingDbContext(new DbContextOptionsBuilder<WhaleWatchingDbContext>().UseSqlServer(connection).Options);
            await db.Database.EnsureCreatedAsync();
            var builder = WebApplication.CreateBuilder(); builder.WebHost.UseUrls("http://127.0.0.1:0"); builder.Logging.ClearProviders();
            var clock = new ManualClock(); var mail = new FakeMail(); var options = TestOptions(); var failure = new FailureInjector();
            builder.Services.AddDbContext<WhaleWatchingDbContext>(o => o.UseSqlServer(connection, sql => sql.EnableRetryOnFailure()).AddInterceptors(failure));
            builder.Services.AddSingleton<TimeProvider>(clock);
            builder.Services.AddIdentityCore<ApplicationUser>(o =>
                {
                    o.Password.RequiredLength = 12; o.Password.RequiredUniqueChars = 6;
                    o.Password.RequireUppercase = true; o.Password.RequireLowercase = true;
                    o.Password.RequireDigit = true; o.Password.RequireNonAlphanumeric = true;
                    o.SignIn.RequireConfirmedEmail = true; o.User.RequireUniqueEmail = true;
                }).AddRoles<IdentityRole<Guid>>().AddSignInManager().AddEntityFrameworkStores<WhaleWatchingDbContext>().AddDefaultTokenProviders();
            builder.Services.AddDataProtection(); builder.Services.AddSingleton(Options.Create(options));
            builder.Services.AddScoped<RecoverySecrets>(); builder.Services.AddScoped<PasswordRecoveryService>();
            builder.Services.AddSingleton<IRecoveryEmailSender>(mail); builder.Services.AddScoped<PasswordRecoveryDeliveryProcessor>();
            builder.Services.AddSingleton(Options.Create(new JwtOptions { Issuer = "WWMS.Recovery.Test", Audience = "WWMS.Recovery.Test", SigningKey = SigningKey }));
            builder.Services.AddScoped<IJwtTokenService, JwtTokenService>(); builder.Services.AddScoped<IAuthService, AuthService>();
            builder.Services.AddControllers().AddApplicationPart(typeof(AuthController).Assembly);
            builder.Services.AddRateLimiter(o => o.AddFixedWindowLimiter("auth", limit => { limit.PermitLimit = 1000; limit.Window = TimeSpan.FromMinutes(1); }));
            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
            {
                o.MapInboundClaims = false;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true, ValidIssuer = "WWMS.Recovery.Test", ValidateAudience = true, ValidAudience = "WWMS.Recovery.Test",
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey)), ValidateIssuerSigningKey = true,
                    ClockSkew = TimeSpan.Zero, RoleClaimType = "role"
                };
                o.TokenValidationParameters.LifetimeValidator = (notBefore, expires, _, _) =>
                    expires.HasValue && expires.Value > clock.GetUtcNow().UtcDateTime &&
                    (!notBefore.HasValue || notBefore.Value <= clock.GetUtcNow().UtcDateTime);
                o.Events = new JwtBearerEvents { OnTokenValidated = AccessTokenSecurity.ValidateAsync };
            });
            builder.Services.AddAuthorization(o => { foreach (var role in PortalRoles.All) o.AddPolicy("test:" + role, p => p.RequireRole(role)); });
            var app = builder.Build(); app.UseRateLimiter(); app.UseAuthentication(); app.UseAuthorization(); app.MapControllers();
            foreach (var role in PortalRoles.All) app.MapGet("/test/private/" + role, () => Results.Ok()).RequireAuthorization("test:" + role);
            if (browser)
            {
                // Test host only: fake inbox drives a real browser against the live API. Never mapped in Program.cs.
                app.MapGet("/test/email-preview", () => Results.Content(
                    RecoveryEmailTemplate.Build("000042", clock.GetUtcNow().AddMinutes(10)).Html, "text/html"));
                app.MapPost("/test/process-mail", async (IServiceScopeFactory scopes) =>
                {
                    await using var scope = scopes.CreateAsyncScope(); await scope.ServiceProvider.GetRequiredService<PasswordRecoveryDeliveryProcessor>().ProcessAsync(default);
                    return Results.Ok();
                });
                app.MapGet("/test/inbox/{role}", (string role) => Results.Json(new { code = mail.Sent.LastOrDefault(x => x.Email == Email(role))?.Code }));
                app.MapPost("/test/advance/{seconds:int}", (int seconds) => { clock.Advance(TimeSpan.FromSeconds(seconds)); return Results.Ok(); });
                var root = Environment.GetEnvironmentVariable("WWMS_BROWSER_WEB_ROOT")!;
                app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(root) });
                app.MapFallback(async context => { context.Response.ContentType = "text/html"; await context.Response.SendFileAsync(Path.Combine(root, "index.html")); });
            }
            await app.StartAsync();
            var test = new Harness(app, db) { Clock = clock, Mail = mail, Settings = options, Failure = failure, Client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) } };
            foreach (var role in PortalRoles.All)
            {
                var identityRole = new IdentityRole<Guid>(role) { Id = Guid.NewGuid(), NormalizedName = role.ToUpperInvariant() };
                var user = new ApplicationUser
                {
                    Id = Guid.NewGuid(), UserName = role, NormalizedUserName = role.ToUpperInvariant(), Email = Email(role),
                    NormalizedEmail = Email(role).ToUpperInvariant(), EmailConfirmed = true, SecurityStamp = Guid.NewGuid().ToString(), DisplayName = role
                };
                user.PasswordHash = new PasswordHasher<ApplicationUser>().HashPassword(user, OldPassword);
                db.Roles.Add(identityRole); db.Users.Add(user); db.UserRoles.Add(new IdentityUserRole<Guid> { UserId = user.Id, RoleId = identityRole.Id });
                test.ids.Add(role, user.Id);
            }
            await db.SaveChangesAsync(); db.ChangeTracker.Clear(); return test;
        }
        public Task<HttpResponseMessage> Post(string endpoint, object body) => Client.PostAsJsonAsync("/api/auth/" + endpoint, body);
        public async Task<Guid> Start(string email)
        {
            var response = await Post("forgot-password", new { email }); Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<RecoveryAccepted>())!.RecoveryId;
        }
        public async Task Process() { await using var scope = app.Services.CreateAsyncScope(); await scope.ServiceProvider.GetRequiredService<PasswordRecoveryDeliveryProcessor>().ProcessAsync(default); }
        public async Task<string> Deliver(Guid id)
        {
            var row = await db.PasswordRecoveries.AsNoTracking().SingleAsync(x => x.Id == id);
            var email = await db.Users.Where(x => x.Id == row.UserId).Select(x => x.Email).SingleAsync();
            await Process(); return Mail.Sent.Last(x => x.Email == email).Code;
        }
        public async Task<string> Verify(Guid id, string code)
        {
            var response = await Post("verify-reset-otp", new { recoveryId = id, code }); Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<RecoveryVerified>())!.ResetAuthorization;
        }
        public Task<HttpResponseMessage> Reset(Guid id, string grant, string password = NewPassword, string confirmation = NewPassword) =>
            Post("reset-password", new { recoveryId = id, resetAuthorization = grant, newPassword = password, confirmPassword = confirmation });
        public async Task<JsonElement> Login(string email, string password)
        {
            var response = await Post("login", new { email, password }); Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return await response.Content.ReadFromJsonAsync<JsonElement>();
        }
        public Task<HttpResponseMessage> Protected(string token, string role)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, "/test/private/" + role); request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token); return Client.SendAsync(request);
        }
        public string LegacyToken(string role) => new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            issuer: "WWMS.Recovery.Test", audience: "WWMS.Recovery.Test", claims: [new Claim("sub", ids[role].ToString()), new Claim("role", role)],
            expires: DateTime.UtcNow.AddMinutes(15), signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey)), SecurityAlgorithms.HmacSha256)));
        public async ValueTask DisposeAsync() { Client.Dispose(); await app.DisposeAsync(); await db.Database.EnsureDeletedAsync(); await db.DisposeAsync(); }
    }
}

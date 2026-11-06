using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Contact;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Support;

namespace WhaleWatching.Api.Tests;

public sealed partial class ComplaintAccountabilityTests
{
    private static SubmitSupportRequest SupportTicket(string portal = "NotSure") =>
        new(Guid.NewGuid(), " Support Visitor ", "visitor@example.test", portal, " GPS issue ", "GPS & Tracking Issues", " Tracker position is not updating. ");

    [SqlServerFact]
    public async Task Support_AllPortalRolesAndPublicUsersPersistRequests_AndRetryWithoutDuplicates()
    {
        await using var test = await Harness.CreateAsync();
        foreach (var role in PortalRoles.All.Cast<string?>().Append(null))
        {
            var ticket = SupportTicket(role ?? "NotSure");
            using var response = await test.Send(role, HttpMethod.Post, "/api/support/requests", ticket);
            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(ticket.SubmissionId, payload.GetProperty("requestId").GetGuid());
            var saved = await test.Db.SupportRequests.AsNoTracking().SingleAsync(x => x.Id == ticket.SubmissionId);
            Assert.Equal(role is null ? null : (Guid?)test.Users[role], saved.UserId);
            Assert.Equal("Support Visitor", saved.FullName); Assert.Equal("GPS issue", saved.Subject);
            Assert.Null(saved.NotifiedAtUtc);
        }
        var repeated = SupportTicket();
        var results = await Task.WhenAll(Enumerable.Range(0, 3).Select(_ => test.Send(null, HttpMethod.Post, "/api/support/requests", repeated)));
        Assert.All(results, r => Assert.Equal(HttpStatusCode.Accepted, r.StatusCode));
        Assert.Equal(1, await test.Db.SupportRequests.CountAsync(x => x.Id == repeated.SubmissionId));
        using var conflict = await test.Send(null, HttpMethod.Post, "/api/support/requests", repeated with { Message = "Different issue" });
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
    }

    [SqlServerFact]
    public async Task Support_RejectsInvalidDataAndHoneypots_AndRateLimitsBeforeStorage()
    {
        await using (var test = await Harness.CreateAsync())
        {
            var valid = SupportTicket();
            foreach (var request in new[] { valid with { SubmissionId = Guid.Empty }, valid with { FullName = " " },
                valid with { Email = "invalid" }, valid with { Subject = "\n\t" }, valid with { Message = " " },
                valid with { Message = new string('x', 4001) }, valid with { Portal = "Unknown" },
                valid with { Category = "Invented" }, valid with { Website = "spam.example" } })
                Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(null, HttpMethod.Post, "/api/support/requests", request)).StatusCode);
            Assert.Empty(await test.Db.SupportRequests.ToListAsync());
        }
        await using (var test = await Harness.CreateAsync(supportLimit: 1))
        {
            Assert.Equal(HttpStatusCode.Accepted, (await test.Send(null, HttpMethod.Post, "/api/support/requests", SupportTicket())).StatusCode);
            Assert.Equal(HttpStatusCode.TooManyRequests, (await test.Send(null, HttpMethod.Post, "/api/support/requests", SupportTicket())).StatusCode);
            Assert.Equal(1, await test.Db.SupportRequests.CountAsync());
        }
    }

    [SqlServerFact]
    public async Task Support_StorageFailureCannotReturnSuccess_AndNotificationFailureCannotLoseAcceptedRequest()
    {
        await using var test = await Harness.CreateAsync();
        var ticket = SupportTicket(); test.Failure.FailSupportSave = true;
        using var failed = await test.Send(null, HttpMethod.Post, "/api/support/requests", ticket);
        Assert.Equal(HttpStatusCode.InternalServerError, failed.StatusCode);
        Assert.DoesNotContain("Simulated support", await failed.Content.ReadAsStringAsync());
        Assert.Empty(await test.Db.SupportRequests.ToListAsync());
        Assert.Equal(HttpStatusCode.Accepted, (await test.Send(null, HttpMethod.Post, "/api/support/requests", ticket)).StatusCode);
        var mail = new CapturedSupportMail { Fail = true };
        var dispatcher = new SupportNotificationDispatcher(test.Db, mail, TimeProvider.System, NullLogger<SupportNotificationDispatcher>.Instance);
        Assert.True(await dispatcher.DispatchNextAsync(default));
        var saved = await test.Db.SupportRequests.AsNoTracking().SingleAsync();
        Assert.Null(saved.NotifiedAtUtc); Assert.Equal(1, saved.NotificationAttempts);
        Assert.Null(saved.NotificationLeaseId); Assert.True(saved.NextNotificationAtUtc > DateTimeOffset.UtcNow);
        mail.Fail = false;
        await test.Db.SupportRequests.ExecuteUpdateAsync(s => s.SetProperty(x => x.NextNotificationAtUtc, DateTimeOffset.UtcNow.AddMinutes(-1)));
        Assert.True(await dispatcher.DispatchNextAsync(default));
        Assert.NotNull((await test.Db.SupportRequests.AsNoTracking().SingleAsync()).NotifiedAtUtc);
        var sent = Assert.Single(mail.Sent);
        Assert.Equal(ticket.SubmissionId, sent.Reference); Assert.Equal("GPS issue", sent.Subject);
        Assert.Contains("Category: GPS & Tracking Issues", sent.Request.Message);
        Assert.Contains("Portal: NotSure", sent.Request.Message);
        Assert.False(await dispatcher.DispatchNextAsync(default));
    }

    [SqlServerFact]
    public async Task Support_NotificationLeasePreventsConcurrentDelivery_AndRecoversExpiredLease()
    {
        await using var test = await Harness.CreateAsync();
        var ticket = SupportTicket();
        await test.Send(null, HttpMethod.Post, "/api/support/requests", ticket);
        await test.Db.SupportRequests.ExecuteUpdateAsync(s => s.SetProperty(x => x.NotificationLeaseId, Guid.NewGuid())
            .SetProperty(x => x.NotificationLeaseUntilUtc, DateTimeOffset.UtcNow.AddMinutes(-1)));
        await using var other = new WhaleWatchingDbContext(new DbContextOptionsBuilder<WhaleWatchingDbContext>()
            .UseSqlServer(test.Db.Database.GetConnectionString()).Options);
        var mail = new CapturedSupportMail();
        var a = new SupportNotificationDispatcher(test.Db, mail, TimeProvider.System, NullLogger<SupportNotificationDispatcher>.Instance);
        var b = new SupportNotificationDispatcher(other, mail, TimeProvider.System, NullLogger<SupportNotificationDispatcher>.Instance);
        await Task.WhenAll(a.DispatchNextAsync(default), b.DispatchNextAsync(default));
        Assert.Single(mail.Sent);
        var saved = await test.Db.SupportRequests.AsNoTracking().SingleAsync();
        Assert.Equal(1, saved.NotificationAttempts); Assert.NotNull(saved.NotifiedAtUtc);
    }

    [SqlServerFact]
    public async Task Support_MigrationCreatesDurableTable_WithoutChangingExistingPortalTables()
    {
        await using var db = new WhaleWatchingDbContext(new DbContextOptionsBuilder<WhaleWatchingDbContext>().UseSqlServer(Harness.Connection()).Options);
        try
        {
            await db.Database.MigrateAsync();
            Assert.Empty(await db.Database.GetPendingMigrationsAsync());
            Assert.Equal(0, await db.SupportRequests.CountAsync());
            Assert.Equal(0, await db.Users.CountAsync());
        }
        finally { await db.Database.EnsureDeletedAsync(); }
    }

    [ComplaintBrowserFact]
    public async Task Support_Browser_AllPortals_RealDatabaseAcceptance_AndResponsiveFailures()
    {
        await using var test = await Harness.CreateAsync();
        var info = new ProcessStartInfo("node") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        info.WorkingDirectory = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../"));
        info.ArgumentList.Add(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../scripts/tests/support-center.cjs")));
        info.Environment["WWMS_WEB_URL"] = test.Client.BaseAddress!.ToString();
        using var process = Process.Start(info)!;
        var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
        try { await process.WaitForExitAsync(new CancellationTokenSource(TimeSpan.FromMinutes(5)).Token); }
        catch (OperationCanceledException) { process.Kill(entireProcessTree: true); throw; }
        var browserOutput = await stdout;
        Console.WriteLine(browserOutput);
        Assert.True(process.ExitCode == 0, browserOutput + await stderr);
        var saved = await test.Db.SupportRequests.AsNoTracking().ToListAsync();
        Assert.True(saved.Count >= 2);
        Assert.All(saved, x => Assert.Equal("Support browser fixture", x.FullName));
        var mail = new CapturedSupportMail();
        var dispatcher = new SupportNotificationDispatcher(test.Db, mail, TimeProvider.System, NullLogger<SupportNotificationDispatcher>.Instance);
        while (await dispatcher.DispatchNextAsync(default)) { }
        Assert.Equal(saved.Count, mail.Sent.Count);
        Assert.All(await test.Db.SupportRequests.AsNoTracking().ToListAsync(), x => Assert.NotNull(x.NotifiedAtUtc));
    }

    private sealed class CapturedSupportMail : IContactEmailSender
    {
        public bool Fail { get; set; }
        public ConcurrentQueue<(ContactRequest Request, Guid Reference, string Subject)> Sent { get; } = new();
        public Task SendAsync(ContactRequest request, CancellationToken ct) => throw new InvalidOperationException("Support must use its notification subject.");
        public async Task SendSupportAsync(ContactRequest request, Guid reference, string subject, CancellationToken ct)
        {
            await Task.Delay(40, ct);
            if (Fail) throw new InvalidOperationException("sensitive-smtp-fixture");
            Sent.Enqueue((request, reference, subject));
        }
    }
}

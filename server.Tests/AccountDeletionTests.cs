using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Tests;

public sealed partial class ComplaintAccountabilityTests
{
    private static async Task AddSpareAdmin(Harness test)
    {
        var spare = new ApplicationUser { Id = Guid.NewGuid(), UserName = "spare-admin", NormalizedUserName = "SPARE-ADMIN",
            Email = "spare@example.test", NormalizedEmail = "SPARE@EXAMPLE.TEST", EmailConfirmed = true, SecurityStamp = Guid.NewGuid().ToString() };
        spare.PasswordHash = new PasswordHasher<ApplicationUser>().HashPassword(spare, "BrowserTest#2026!Only");
        test.Db.Users.Add(spare);
        test.Db.UserRoles.Add(new IdentityUserRole<Guid> { UserId = spare.Id, RoleId = test.Roles[PortalRoles.Admin] });
        await test.Db.SaveChangesAsync(); test.Db.ChangeTracker.Clear();
    }

    private static async Task<JsonElement> AccountLogin(Harness test, string role)
    {
        using var response = await test.Client.PostAsJsonAsync("/api/auth/login", new { email = role.ToLowerInvariant() + "@complaint-test.example", password = "BrowserTest#2026!Only" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static Task<HttpResponseMessage> AccountRequest(Harness test, string token, HttpMethod method, object body)
    {
        var request = new HttpRequestMessage(method, "/api/auth/account") { Content = JsonContent.Create(body) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return test.Client.SendAsync(request);
    }

    [SqlServerFact]
    public async Task AccountDeletion_ExactConfirmationAndOwnAccountOnly_CannotBypassUi()
    {
        await using var test = await Harness.CreateAsync(validateAccessTokens: true);
        Assert.Equal(HttpStatusCode.Unauthorized, (await test.Send(null, HttpMethod.Delete, "/api/auth/account", new { confirmation = "confirm" })).StatusCode);
        foreach (var role in new[] { PortalRoles.Admin, PortalRoles.BoatOwner, PortalRoles.BoatCrew })
        {
            foreach (var confirmation in new string?[] { null, "", "Confirm", "CONFIRM", "confirm ", " confirm", "confirm\n", "confirmed" })
                Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(role, HttpMethod.Delete, "/api/auth/account", new { confirmation })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(role, HttpMethod.Delete, "/api/auth/account", new { confirmation = "confirm", userId = test.Users[PortalRoles.Ops] })).StatusCode);
        }
        Assert.Empty(await test.Db.Users.Where(x => x.AccountDeletedAtUtc != null).ToListAsync());
        Assert.Equal(PortalRoles.All.Length, await test.Db.UserRoles.CountAsync());
    }

    [SqlServerFact]
    public async Task AccountDeletion_AllPortalRoles_RevokeCredentialsRefreshAndAccessTokens_WithoutDeletingSharedHistory()
    {
        await using var test = await Harness.CreateAsync(validateAccessTokens: true);
        await AddSpareAdmin(test);
        var counts = new[] { await test.Db.Users.CountAsync(), await test.Db.Trips.CountAsync(), await test.Db.Boats.CountAsync(), await test.Db.PassengerProfiles.CountAsync(), await test.Db.PassengerComplaints.CountAsync() };
        foreach (var role in PortalRoles.All)
        {
            var auth = await AccountLogin(test, role);
            var token = auth.GetProperty("accessToken").GetString()!;
            var before = await test.Db.Users.AsNoTracking().SingleAsync(x => x.Id == test.Users[role]);
            using var deleted = await AccountRequest(test, token, HttpMethod.Delete, new { confirmation = "confirm" });
            Assert.Equal(HttpStatusCode.OK, deleted.StatusCode);
            var user = await test.Db.Users.AsNoTracking().SingleAsync(x => x.Id == before.Id);
            Assert.NotNull(user.AccountDeletedAtUtc); Assert.Null(user.PasswordHash);
            Assert.Equal(before.Email, user.Email); Assert.Equal(before.Bio, user.Bio);
            Assert.NotEqual(before.SecurityStamp, user.SecurityStamp);
            Assert.False(await test.Db.UserRoles.AnyAsync(x => x.UserId == user.Id));
            Assert.False(await test.Db.RefreshTokens.AnyAsync(x => x.UserId == user.Id && x.RevokedAtUtc == null));
            Assert.Equal(HttpStatusCode.Unauthorized, (await AccountRequest(test, token, HttpMethod.Delete, new { confirmation = "confirm" })).StatusCode);
            // Legacy tokens without a security-stamp claim must also be invalidated.
            Assert.Equal(HttpStatusCode.Unauthorized, (await test.Send(role, HttpMethod.Delete, "/api/auth/account", new { confirmation = "confirm" })).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await test.Client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = auth.GetProperty("refreshToken").GetString() })).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await test.Client.PostAsJsonAsync("/api/auth/login", new { email = before.Email, password = "BrowserTest#2026!Only" })).StatusCode);
        }
        Assert.Equal(counts, new[] { await test.Db.Users.CountAsync(), await test.Db.Trips.CountAsync(), await test.Db.Boats.CountAsync(), await test.Db.PassengerProfiles.CountAsync(), await test.Db.PassengerComplaints.CountAsync() });
        Assert.Equal(PortalRoles.All.Length, await test.Db.Users.CountAsync(x => x.AccountDeletedAtUtc != null));
        Assert.Equal(1, await test.Db.UserRoles.CountAsync());
    }

    [SqlServerFact]
    public async Task AccountDeletion_BlocksUnsafeOperationalDeletion_AndRetainsCrewHistory()
    {
        await using var test = await Harness.CreateAsync(validateAccessTokens: true);
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.Admin, HttpMethod.Delete, "/api/auth/account", new { confirmation = "confirm" })).StatusCode);
        var owner = test.Users[PortalRoles.BoatOwner]; var crew = test.Users[PortalRoles.BoatCrew];
        var boat = await test.Db.Boats.FirstAsync(); boat.OwnerId = owner;
        var trips = await test.Db.Trips.OrderBy(x => x.ScheduledDepartureUtc).ToListAsync();
        var past = trips.First(); var future = trips.Last(); future.Status = TripStatus.Ongoing;
        test.Db.CrewAssignments.Add(new CrewAssignment { Id = Guid.NewGuid(), BoatId = boat.Id, CrewUserId = crew, IsActive = true });
        test.Db.OwnerCrewMemberships.Add(new OwnerCrewMembership { Id = Guid.NewGuid(), OwnerId = owner, CrewUserId = crew });
        test.Db.TripCrewAssignments.AddRange(new TripCrewAssignment { Id = Guid.NewGuid(), TripId = past.Id, CrewUserId = crew }, new TripCrewAssignment { Id = Guid.NewGuid(), TripId = future.Id, CrewUserId = crew });
        await test.Db.SaveChangesAsync(); test.Db.ChangeTracker.Clear();
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Delete, "/api/auth/account", new { confirmation = "confirm" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.BoatCrew, HttpMethod.Delete, "/api/auth/account", new { confirmation = "confirm" })).StatusCode);
        await test.Db.Trips.Where(x => x.Id == future.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, TripStatus.Scheduled));
        Assert.Equal(HttpStatusCode.OK, (await test.Send(PortalRoles.BoatCrew, HttpMethod.Delete, "/api/auth/account", new { confirmation = "confirm" })).StatusCode);
        Assert.False(await test.Db.CrewAssignments.AnyAsync(x => x.CrewUserId == crew && x.IsActive));
        Assert.False(await test.Db.OwnerCrewMemberships.AnyAsync(x => x.CrewUserId == crew));
        var history = Assert.Single(await test.Db.TripCrewAssignments.Where(x => x.CrewUserId == crew).ToListAsync());
        Assert.Equal(past.Id, history.TripId);
        Assert.True(await test.Db.Trips.AnyAsync(x => x.Id == past.Id));
        Assert.True(await test.Db.Users.AnyAsync(x => x.Id == owner && x.AccountDeletedAtUtc == null));
    }

    [SqlServerFact]
    public async Task AccountDeletion_StorageFailureRollsBack_AndConcurrentRetriesAreSafe()
    {
        await using var test = await Harness.CreateAsync(validateAccessTokens: true);
        var role = PortalRoles.BoatCrew; var id = test.Users[role];
        var auth = await AccountLogin(test, role);
        test.Db.PasswordRecoveries.Add(new PasswordRecovery { Id = Guid.NewGuid(), UserId = id });
        await test.Db.SaveChangesAsync(); test.Db.ChangeTracker.Clear();
        test.Failure.FailAccountDeletionSave = true;
        var token = auth.GetProperty("accessToken").GetString()!;
        using var failed = await AccountRequest(test, token, HttpMethod.Delete, new { confirmation = "confirm" });
        Assert.Equal(HttpStatusCode.InternalServerError, failed.StatusCode);
        Assert.DoesNotContain("Simulated", await failed.Content.ReadAsStringAsync());
        Assert.Null((await test.Db.Users.AsNoTracking().SingleAsync(x => x.Id == id)).AccountDeletedAtUtc);
        Assert.True(await test.Db.UserRoles.AnyAsync(x => x.UserId == id));
        Assert.True(await test.Db.RefreshTokens.AnyAsync(x => x.UserId == id && x.RevokedAtUtc == null));
        var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => AccountRequest(test, token, HttpMethod.Delete, new { confirmation = "confirm" })));
        Assert.Contains(results, x => x.StatusCode == HttpStatusCode.OK);
        Assert.All(results, x => Assert.Contains(x.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Unauthorized }));
        Assert.NotNull((await test.Db.PasswordRecoveries.AsNoTracking().SingleAsync(x => x.UserId == id)).CancelledAt);
        Assert.NotNull((await test.Db.Users.AsNoTracking().SingleAsync(x => x.Id == id)).AccountDeletedAtUtc);
    }

    [SqlServerFact]
    public async Task AccountDeletion_MigrationIsAdditive_AndBioMappingRemainsUnchanged()
    {
        await using (var db = new WhaleWatchingDbContext(new DbContextOptionsBuilder<WhaleWatchingDbContext>().UseSqlServer(Harness.Connection()).Options))
        {
            try { await db.Database.MigrateAsync(); Assert.Empty(await db.Database.GetPendingMigrationsAsync()); Assert.Equal(0, await db.Users.CountAsync(x => x.AccountDeletedAtUtc != null)); }
            finally { await db.Database.EnsureDeletedAsync(); }
        }
        await using var test = await Harness.CreateAsync(validateAccessTokens: true);
        foreach (var role in new[] { PortalRoles.BoatOwner, PortalRoles.BoatCrew })
        {
            var user = await test.Db.Users.SingleAsync(x => x.Id == test.Users[role]);
            var resource = role == PortalRoles.BoatOwner ? "owners" : "crew";
            Assert.Equal(HttpStatusCode.NoContent, (await test.Send(PortalRoles.Admin, HttpMethod.Patch, $"/api/admin/records/{resource}/{user.Id}",
                new { name = user.DisplayName, nic = role + "-NIC", email = user.Email, phone = "0701234567", address = "Preserved bio text", role = "Captain", boatId = (Guid?)null })).StatusCode);
            Assert.Equal("Preserved bio text", (await test.Db.Users.AsNoTracking().SingleAsync(x => x.Id == user.Id)).Bio);
        }
    }

    [ComplaintBrowserFact]
    public async Task AccountDeletion_Browser_RealDeletionAllPortals_ResponsiveValidationErrorsAndSessions()
    {
        await using var test = await Harness.CreateAsync(validateAccessTokens: true);
        await AddSpareAdmin(test);
        foreach (var role in new[] { PortalRoles.BoatOwner, PortalRoles.BoatCrew })
        {
            var user = await test.Db.Users.SingleAsync(x => x.Id == test.Users[role]);
            user.Bio = "Existing profile biography"; user.NicNumber = role + "-NIC"; user.PhoneNumber = "0701234567";
        }
        await test.Db.SaveChangesAsync(); test.Db.ChangeTracker.Clear();
        var info = new ProcessStartInfo("node") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        info.WorkingDirectory = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../"));
        info.ArgumentList.Add("scripts/tests/account-management.cjs");
        info.Environment["WWMS_WEB_URL"] = test.Client.BaseAddress!.ToString();
        info.Environment["WWMS_OWNER_ID"] = test.Users[PortalRoles.BoatOwner].ToString();
        info.Environment["WWMS_CREW_ID"] = test.Users[PortalRoles.BoatCrew].ToString();
        using var process = Process.Start(info)!;
        var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
        try { await process.WaitForExitAsync(new CancellationTokenSource(TimeSpan.FromMinutes(5)).Token); }
        catch (OperationCanceledException) { process.Kill(entireProcessTree: true); throw; }
        var output = await stdout; Console.WriteLine(output);
        Assert.True(process.ExitCode == 0, output + await stderr);
        Assert.Equal(PortalRoles.All.Length, await test.Db.Users.CountAsync(x => x.AccountDeletedAtUtc != null));
        Assert.True(await test.Db.Trips.AnyAsync()); Assert.True(await test.Db.PassengerComplaints.AnyAsync());
    }
}

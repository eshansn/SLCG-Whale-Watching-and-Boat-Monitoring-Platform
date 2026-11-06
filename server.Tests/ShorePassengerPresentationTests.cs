using System.Diagnostics;
using System.Net;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Tests;

public sealed partial class ComplaintAccountabilityTests
{
    [ComplaintBrowserFact]
    public async Task ShorePassengerPresentation_Browser_RealManifestSummaryUpdatesAndResponsiveLayout()
    {
        await using var test = await Harness.CreateAsync(validateAccessTokens: true);
        var trip = await test.Db.Trips.SingleAsync(x => x.Status == TripStatus.Scheduled);
        test.Db.TripPassengers.RemoveRange(await test.Db.TripPassengers.Where(x => x.TripId == trip.Id).ToListAsync());
        var specifications = new[] {
            ("Local Adult", "local", "LK", "adult"), ("Local Child", "local", "LK", "child"), ("Local Small", "local", "LK", "small"),
            ("Foreign Adult", "foreign", "GB", "adult"), ("Foreign Child", "foreign", "US", "child"), ("Foreign Small", "foreign", "JP", "small"),
            ("Local Legacy", "local", (string?)null, "adult"), ("Foreign Missing Country", "foreign", (string?)null, "child"),
            ("Special Needs", "local", "LK", "specialneeds"), ("Invalid Country", "foreign", "ZZ", "adult"),
            ("Country Only", "", "DE", "adult"), ("Missing Classification", "", (string?)null, "")
        };
        var fixtureIds = new Dictionary<string, Guid>();
        foreach (var (name, nationality, country, age) in specifications)
        {
            var person = new PassengerProfile { Id = Guid.NewGuid(), Name = name, PassengerType = nationality, CountryCode = country,
                AgeCategory = age, IdentificationNumber = name, NormalizedIdentificationNumber = name.ToUpperInvariant(),
                PhoneNumber = "0701234567", NormalizedPhoneNumber = "0701234567", CreatedAtUtc = DateTimeOffset.UtcNow };
            test.Db.PassengerProfiles.Add(person);
            test.Db.TripPassengers.Add(new TripPassenger { Id = Guid.NewGuid(), TripId = trip.Id, Passenger = person, PrimaryPassenger = person, RegisteredAtUtc = DateTimeOffset.UtcNow });
            fixtureIds.Add(name, person.Id);
        }
        trip.PassengerCount = specifications.Length;
        await test.Db.SaveChangesAsync(); test.Db.ChangeTracker.Clear();
        var connection = new SqlConnectionStringBuilder(test.Db.Database.GetConnectionString());
        Assert.True(connection.IntegratedSecurity, "Browser fixture mutation requires the disposable integrated-auth SQL test target.");
        var info = new ProcessStartInfo("node") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        info.WorkingDirectory = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../"));
        info.ArgumentList.Add("scripts/tests/shore-passenger-summary.cjs");
        info.Environment["WWMS_WEB_URL"] = test.Client.BaseAddress!.ToString();
        info.Environment["WWMS_SHORE_TRIP_ID"] = trip.Id.ToString();
        info.Environment["WWMS_FIXTURE_DATABASE"] = connection.InitialCatalog;
        info.Environment["WWMS_FIXTURE_SERVER"] = connection.DataSource;
        info.Environment["WWMS_FIXTURE_PASSENGERS"] = System.Text.Json.JsonSerializer.Serialize(fixtureIds);
        using var process = Process.Start(info)!;
        var output = process.StandardOutput.ReadToEndAsync(); var errors = process.StandardError.ReadToEndAsync();
        try { await process.WaitForExitAsync(new CancellationTokenSource(TimeSpan.FromMinutes(4)).Token); }
        catch (OperationCanceledException) { process.Kill(entireProcessTree: true); throw; }
        var text = await output; Console.WriteLine(text);
        Assert.True(process.ExitCode == 0, text + await errors);
        // Presentation tests never exercise a write workflow or create attendance audit rows.
        Assert.Equal(0, await test.Db.TripPassengerAttendances.CountAsync());
        Assert.Equal(0, await test.Db.PassengerAttendanceAudits.CountAsync());
        Assert.Null((await test.Db.Trips.AsNoTracking().SingleAsync(x => x.Id == trip.Id)).PassengerVerificationFinalizedAtUtc);
    }
}

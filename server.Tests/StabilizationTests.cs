using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Tests;

public sealed partial class ComplaintAccountabilityTests
{
    [SqlServerFact]
    public async Task SpecialNeedsCounters_TrackNewAndReturningRegistrations_WithoutDoubleCounting()
    {
        await using var test = await Harness.CreateAsync();
        var boat = await test.Db.Boats.FirstAsync(); boat.MaximumCapacity = 20;
        var first = new Trip { Id = Guid.NewGuid(), BoatId = boat.Id, InvitationCode = "special-needs-first",
            Status = TripStatus.Scheduled, ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(1) };
        var next = new Trip { Id = Guid.NewGuid(), BoatId = boat.Id, InvitationCode = "special-needs-next",
            Status = TripStatus.Scheduled, ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(2) };
        test.Db.Trips.AddRange(first, next); await test.Db.SaveChangesAsync();
        var created = await test.Send(null, HttpMethod.Post, $"/api/passenger/trips/{first.InvitationCode}/passengers", new
        {
            name = "Special needs test passenger", identificationNumber = "SPECIAL-ID-1", phoneNumber = "0700000010",
            passengerType = "local", gender = "other", ageCategory = "specialneeds", specialNeedType = "Mobility", selfCareConfirmed = true
        });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(1, (await test.Db.Trips.AsNoTracking().SingleAsync(trip => trip.Id == first.Id)).SpecialNeedsCount);
        var path = $"/api/passenger/trips/{next.InvitationCode}/returning-passenger";
        for (var retry = 0; retry < 2; retry++)
            Assert.Equal(HttpStatusCode.OK, (await test.Send(null, HttpMethod.Post, path, new { identifier = "SPECIAL-ID-1" })).StatusCode);
        var saved = await test.Db.Trips.AsNoTracking().SingleAsync(trip => trip.Id == next.Id);
        Assert.Equal(1, saved.PassengerCount); Assert.Equal(1, saved.SpecialNeedsCount);
    }

    [SqlServerFact]
    public async Task SpecialNeedsCounters_MoveWithTransferredPassengers_AndIdempotentRetry()
    {
        await using var test = await Harness.CreateAsync();
        var boat = new Boat { Id = Guid.NewGuid(), OwnerId = test.Users[PortalRoles.BoatOwner], Name = "Counter test boat",
            RegistrationNumber = "COUNTER-TEST", MaximumCapacity = 20, Approval = ApprovalStatus.Approved };
        var source = new Trip { Id = Guid.NewGuid(), Boat = boat, Status = TripStatus.Scheduled,
            ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(1), PassengerCount = 1, SpecialNeedsCount = 1 };
        var destination = new Trip { Id = Guid.NewGuid(), Boat = boat, Status = TripStatus.Scheduled,
            ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(2) };
        var passenger = new PassengerProfile { Id = Guid.NewGuid(), Name = "Transfer test", NormalizedIdentificationNumber = "SPECIALTRANSFER",
            AgeCategory = "specialneeds", PassengerType = "local", CountryCode = "LK", SpecialNeedType = "Mobility", SelfCareConfirmed = true };
        test.Db.Trips.AddRange(source, destination);
        test.Db.TripPassengers.Add(new TripPassenger { Id = Guid.NewGuid(), Trip = source, Passenger = passenger, PrimaryPassenger = passenger });
        await test.Db.SaveChangesAsync();
        var body = new { clientRequestId = Guid.NewGuid(), sourceTripId = source.Id, destinationTripId = destination.Id,
            passengerIds = new[] { passenger.Id }, crewUserIds = Array.Empty<Guid>(), reason = "Operational issue" };
        for (var retry = 0; retry < 2; retry++) await test.Ok(PortalRoles.BoatOwner, HttpMethod.Post, "/api/operations/transfers", body);
        var savedSource = await test.Db.Trips.AsNoTracking().SingleAsync(trip => trip.Id == source.Id);
        var savedDestination = await test.Db.Trips.AsNoTracking().SingleAsync(trip => trip.Id == destination.Id);
        Assert.Equal(0, savedSource.PassengerCount); Assert.Equal(0, savedSource.SpecialNeedsCount);
        Assert.Equal(1, savedDestination.PassengerCount); Assert.Equal(1, savedDestination.SpecialNeedsCount);
        Assert.Equal(1, await test.Db.TripTransfers.CountAsync());
    }

    [SqlServerFact]
    public async Task BoatApproval_RejectsUndefinedNumericStatuses_WithoutChangingApprovals()
    {
        await using var test = await Harness.CreateAsync();
        var boat = await test.Db.Boats.AsNoTracking().FirstAsync();
        foreach (var actor in new[] { PortalRoles.Admin, PortalRoles.Wildlife })
        foreach (var approval in new[] { "999", "-1", "Approved, Rejected" })
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(actor, HttpMethod.Patch,
                $"/api/operations/boats/{boat.Id}/approval", new { approval })).StatusCode);
            var current = await test.Db.Boats.AsNoTracking().SingleAsync(row => row.Id == boat.Id);
            Assert.Equal(boat.Approval, current.Approval);
            Assert.Equal(boat.WildlifeApproval, current.WildlifeApproval);
        }
    }

    [SqlServerFact]
    public async Task ShoreAttendance_RejectsUndefinedNumericStatuses_WithoutFinalizingOrWritingAudit()
    {
        await using var test = await Harness.CreateAsync();
        var (trip, primary, _) = await SeedShoreGroup(test);
        var passengerIds = await test.Db.TripPassengers.Where(row => row.TripId == trip.Id).Select(row => row.PassengerId).ToArrayAsync();
        foreach (var status in new[] { "999", "-1", "Present, NotPresent" })
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(PortalRoles.ShoreCrew, HttpMethod.Put,
                $"/api/shore/trips/{trip.Id}/attendance/groups/{primary.Id}",
                new { items = passengerIds.Select(passengerId => new { passengerId, status }) })).StatusCode);
            Assert.Equal(0, await test.Db.TripPassengerAttendances.CountAsync());
            Assert.Equal(0, await test.Db.PassengerAttendanceAudits.CountAsync());
            Assert.Null((await test.Db.Trips.AsNoTracking().SingleAsync(row => row.Id == trip.Id)).PassengerVerificationFinalizedAtUtc);
        }
    }

    [SqlServerFact]
    public async Task ReturningPassenger_SharedPhoneRequiresUniqueIdentity_AndKeepsUniqueLookupsWorking()
    {
        await using var test = await Harness.CreateAsync();
        var passengers = await test.Db.PassengerProfiles.OrderBy(passenger => passenger.Name).ToListAsync();
        var primary = passengers[0]; var companion = passengers[1]; var unique = passengers[2];
        primary.IdentificationNumber = "RETURN-ID-1"; primary.NormalizedIdentificationNumber = "RETURNID1";
        primary.NormalizedPhoneNumber = companion.NormalizedPhoneNumber = "0701234567";
        unique.NormalizedPhoneNumber = "0700000003";
        var trip = new Trip { Id = Guid.NewGuid(), BoatId = (await test.Db.Boats.FirstAsync()).Id,
            InvitationCode = "return-lookup-test", Status = TripStatus.Scheduled, ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(1) };
        test.Db.Trips.Add(trip);
        (await test.Db.Boats.FirstAsync()).MaximumCapacity = 20;
        await test.Db.SaveChangesAsync();
        var path = $"/api/passenger/trips/{trip.InvitationCode}/returning-passenger";
        var sessionCount = await test.Db.PassengerSessions.CountAsync();
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(null, HttpMethod.Post, path, new { identifier = "070 123 4567" })).StatusCode);
        Assert.Equal(sessionCount, await test.Db.PassengerSessions.CountAsync());
        Assert.False(await test.Db.TripPassengers.AnyAsync(row => row.TripId == trip.Id));
        foreach (var (identifier, expectedId) in new[] { ("return-id-1", primary.Id), ("0700000003", unique.Id) })
        {
            var response = await test.Send(null, HttpMethod.Post, path, new { identifier });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(expectedId, (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid());
        }
        Assert.Equal(2, await test.Db.TripPassengers.CountAsync(row => row.TripId == trip.Id));
    }

    [SqlServerFact]
    public async Task StaffUpdates_RejectNonStaffAccounts_WithoutChangingIdentityOrRoles()
    {
        await using var test = await Harness.CreateAsync();
        foreach (var actor in new[] { PortalRoles.Admin, PortalRoles.Wildlife })
        foreach (var targetRole in new[] { PortalRoles.BoatOwner, PortalRoles.BoatCrew, PortalRoles.Passenger })
        {
            var id = test.Users[targetRole];
            var before = await test.Db.Users.AsNoTracking().SingleAsync(user => user.Id == id);
            var response = await test.Send(actor, HttpMethod.Patch, $"/api/admin/staff/{id}", new
            {
                displayName = "Unexpected staff conversion", userName = before.UserName,
                email = before.Email, role = PortalRoles.Supervisor, isActive = true
            });
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            var after = await test.Db.Users.AsNoTracking().SingleAsync(user => user.Id == id);
            Assert.Equal(before.DisplayName, after.DisplayName);
            Assert.Equal(before.SecurityStamp, after.SecurityStamp);
            Assert.Equal(test.Roles[targetRole], (await test.Db.UserRoles.AsNoTracking().SingleAsync(role => role.UserId == id)).RoleId);
        }
        // Existing permitted staff editing continues to work.
        var supervisor = await test.Db.Users.AsNoTracking().SingleAsync(user => user.Id == test.Users[PortalRoles.Supervisor]);
        await test.Ok(PortalRoles.Wildlife, HttpMethod.Patch, $"/api/admin/staff/{supervisor.Id}", new
        {
            displayName = "Updated supervisor", userName = supervisor.UserName,
            email = supervisor.Email, role = PortalRoles.Supervisor, isActive = true
        });
        Assert.Equal("Updated supervisor", (await test.Db.Users.AsNoTracking().SingleAsync(user => user.Id == supervisor.Id)).DisplayName);
    }
}

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Diagnostics;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Operations;

namespace WhaleWatching.Api.Tests;

public sealed partial class ComplaintAccountabilityTests
{
    private static async Task<(Guid Boat, Guid Crew)> ApprovedTripFixture(Harness test)
    {
        var boat = await test.Db.Boats.FirstAsync();
        boat.OwnerId = test.Users[PortalRoles.BoatOwner]; boat.MaximumCapacity = 30;
        boat.Approval = ApprovalStatus.Approved; boat.WildlifeApproval = ApprovalStatus.Pending;
        var crew = await test.Db.Users.SingleAsync(x => x.Id == test.Users[PortalRoles.BoatCrew]);
        crew.IsCrewCertified = true; crew.CrewType = "Coxswain";
        test.Db.OwnerCrewMemberships.Add(new OwnerCrewMembership { Id = Guid.NewGuid(), OwnerId = boat.OwnerId, CrewUserId = crew.Id });
        test.Db.CrewAssignments.Add(new CrewAssignment { Id = Guid.NewGuid(), BoatId = boat.Id, CrewUserId = crew.Id, Position = "Coxswain", IsActive = true });
        await test.Db.SaveChangesAsync(); test.Db.ChangeTracker.Clear();
        return (boat.Id, crew.Id);
    }

    [Theory]
    [InlineData(0,0,false)] [InlineData(0,2,false)] [InlineData(2,0,false)] [InlineData(2,2,false)]
    [InlineData(1,0,true)] [InlineData(0,1,true)] [InlineData(1,2,true)] [InlineData(2,1,true)] [InlineData(1,1,true)]
    [InlineData(3,0,false)] [InlineData(3,1,false)] [InlineData(1,3,false)] [InlineData(99,1,false)]
    public void BoatTripApproval_PreservesEitherAuthorityPolicy_AndFailsClosed(int admin, int wildlife, bool eligible)
    {
        var boat = new Boat { Approval = (ApprovalStatus)admin, WildlifeApproval = (ApprovalStatus)wildlife };
        Assert.Equal(eligible, BoatTripApproval.IsApproved(boat));
        boat.IsDeleted = true; Assert.False(BoatTripApproval.IsApproved(boat));
    }

    [SqlServerFact]
    public async Task BoatTripApproval_DirectSchedulingAndAutomaticCrew_RequireCurrentDatabaseApproval()
    {
        await using var test = await Harness.CreateAsync();
        var (boatId, crewId) = await ApprovedTripFixture(test);
        var baseCount = await test.Db.Trips.CountAsync();
        var cases = new[] { (0,0,false),(2,0,false),(0,2,false),(2,2,false),(3,0,false),(3,1,false),(1,3,false),
            (1,0,true),(0,1,true),(1,2,true),(2,1,true) };
        var expected = baseCount;
        for (var index = 0; index < cases.Length; index++)
        {
            var (admin, wildlife, allowed) = cases[index];
            await test.Db.Boats.Where(x => x.Id == boatId).ExecuteUpdateAsync(s => s.SetProperty(x => x.Approval, (ApprovalStatus)admin).SetProperty(x => x.WildlifeApproval, (ApprovalStatus)wildlife));
            using var result = await test.Send(PortalRoles.BoatOwner, HttpMethod.Post, "/api/operations/trips", new {
                boatId, scheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(4).AddHours(index), route = "Approval security test", passengerCount = 0,
                crewUserIds = index % 2 == 0 ? new[] { crewId } : Array.Empty<Guid>(), approval = "Approved", wildlifeApproval = "Approved", isApproved = true });
            Assert.Equal(allowed ? HttpStatusCode.Created : HttpStatusCode.Conflict, result.StatusCode);
            if (allowed) expected++;
            else Assert.Contains(BoatTripApproval.SchedulingMessage, await result.Content.ReadAsStringAsync());
            Assert.Equal(expected, await test.Db.Trips.CountAsync());
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Patch, $"/api/operations/boats/{boatId}/approval", new { approval = "Approved" })).StatusCode);
    }

    [SqlServerFact]
    public async Task BoatTripApproval_RevocationBlocksLegacyDepartures_WithoutChangingHistory_AndReapprovalRestoresAccess()
    {
        await using var test = await Harness.CreateAsync();
        var (boatId, _) = await ApprovedTripFixture(test);
        var trip = await test.Db.Trips.SingleAsync(x => x.BoatId == boatId && x.Status == TripStatus.Scheduled);
        trip.PassengerVerificationFinalizedAtUtc = DateTimeOffset.UtcNow;
        await test.Db.SaveChangesAsync(); test.Db.ChangeTracker.Clear();
        var before = await test.Db.Trips.AsNoTracking().OrderBy(x => x.Id).Select(x => new { x.Id,x.Status,x.ScheduledDepartureUtc,x.ActualDepartureUtc,x.ActualArrivalUtc,x.StartedByUserId,x.InvitationCode }).ToListAsync();
        foreach (var approval in new[] { ApprovalStatus.Pending, ApprovalStatus.Rejected, (ApprovalStatus)3 })
        {
            await test.Db.Boats.Where(x => x.Id == boatId).ExecuteUpdateAsync(s => s.SetProperty(x => x.Approval, approval));
            foreach (var role in new[] { PortalRoles.ShoreCrew, PortalRoles.Admin })
            {
                using var denied = await test.Send(role, HttpMethod.Post, $"/api/operations/trips/{trip.Id}/start", new { confirmRescheduleOverride = true, approval = "Approved" });
                Assert.Equal(HttpStatusCode.Conflict, denied.StatusCode);
                Assert.Contains(BoatTripApproval.DepartureMessage, await denied.Content.ReadAsStringAsync());
            }
        }
        Assert.Equal(JsonSerializer.Serialize(before), JsonSerializer.Serialize(await test.Db.Trips.AsNoTracking().OrderBy(x => x.Id).Select(x => new { x.Id,x.Status,x.ScheduledDepartureUtc,x.ActualDepartureUtc,x.ActualArrivalUtc,x.StartedByUserId,x.InvitationCode }).ToListAsync()));
        Assert.Equal(HttpStatusCode.NoContent, (await test.Send(PortalRoles.Admin, HttpMethod.Patch, $"/api/operations/boats/{boatId}/approval", new { approval = "Approved" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await test.Send(PortalRoles.ShoreCrew, HttpMethod.Post, $"/api/operations/trips/{trip.Id}/start", new { })).StatusCode);
        Assert.Equal(TripStatus.Ongoing, (await test.Db.Trips.AsNoTracking().SingleAsync(x => x.Id == trip.Id)).Status);
        await test.Db.Boats.Where(x => x.Id == boatId).ExecuteUpdateAsync(s => s.SetProperty(x => x.Approval, ApprovalStatus.Rejected));
        Assert.Equal(HttpStatusCode.NoContent, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Post, $"/api/operations/trips/{trip.Id}/end", new { })).StatusCode);
    }

    [SqlServerFact]
    public async Task BoatTripApproval_RescheduleCrewAndPatrolRoutesCannotBypass_WhileCancellationRemainsAvailable()
    {
        await using var test = await Harness.CreateAsync();
        var (boatId, crewId) = await ApprovedTripFixture(test);
        await test.Db.Boats.Where(x => x.Id == boatId).ExecuteUpdateAsync(s => s.SetProperty(x => x.Approval, ApprovalStatus.Pending));
        var trip = await test.Db.Trips.AsNoTracking().SingleAsync(x => x.BoatId == boatId && x.Status == TripStatus.Scheduled);
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Patch, $"/api/operations/trips/{trip.Id}/reschedule", new { scheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(8) })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Put, $"/api/operations/trips/{trip.Id}/crew", new { crewUserIds = new[] { crewId } })).StatusCode);
        Assert.Equal(trip.ScheduledDepartureUtc, (await test.Db.Trips.AsNoTracking().SingleAsync(x => x.Id == trip.Id)).ScheduledDepartureUtc);
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.Admin, HttpMethod.Patch, $"/api/operations/trips/{trip.Id}/status", new { status = "Ongoing" })).StatusCode);
        await test.Db.Boats.Where(x => x.Id == boatId).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsPatrolBoat, true).SetProperty(x => x.GpsDeviceId, "APPROVAL-TEST-DEVICE"));
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.Ops, HttpMethod.Post, "/api/operations/patrol-trips/start", new { boatId })).StatusCode);
        await test.Db.Trips.Where(x => x.Id == trip.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.Type, TripType.Patrol));
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.Ops, HttpMethod.Patch, $"/api/operations/trips/{trip.Id}/status", new { status = "Ongoing" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await test.Send(PortalRoles.Ops, HttpMethod.Patch, $"/api/operations/trips/{trip.Id}/status", new { status = "Cancelled" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await test.Send(PortalRoles.Admin, HttpMethod.Patch, $"/api/operations/boats/{boatId}/approval", new { approval = "Approved" })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await test.Send(PortalRoles.Ops, HttpMethod.Post, "/api/operations/patrol-trips/start", new { boatId })).StatusCode);
    }

    [SqlServerFact]
    public async Task BoatTripApproval_AConcurrentRevocationIsObservedBeforeSchedulingCommits()
    {
        await using var test = await Harness.CreateAsync();
        var (boatId, crewId) = await ApprovedTripFixture(test);
        var before = await test.Db.Trips.CountAsync();
        await using var transaction = await test.Db.Database.BeginTransactionAsync();
        await test.Db.Boats.Where(x => x.Id == boatId).ExecuteUpdateAsync(s => s.SetProperty(x => x.Approval, ApprovalStatus.Rejected));
        var request = test.Send(PortalRoles.BoatOwner, HttpMethod.Post, "/api/operations/trips", new { boatId, scheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(4), route = "Concurrent approval", crewUserIds = new[] { crewId } });
        await transaction.CommitAsync();
        Assert.Equal(HttpStatusCode.Conflict, (await request).StatusCode);
        Assert.Equal(before, await test.Db.Trips.CountAsync());
    }

    [ComplaintBrowserFact]
    public async Task BoatTripApproval_Browser_OwnerShoreAndOpsUseRealCurrentApproval()
    {
        await using var test = await Harness.CreateAsync(validateAccessTokens: true);
        var (boatId, _) = await ApprovedTripFixture(test);
        var original = await test.Db.Trips.SingleAsync(x => x.Status == TripStatus.Scheduled);
        original.PassengerVerificationFinalizedAtUtc = DateTimeOffset.UtcNow;
        var pending = new Boat { Id = Guid.NewGuid(), OwnerId = test.Users[PortalRoles.BoatOwner], Name = "Pending authority review", RegistrationNumber = "APPROVAL-PENDING", MaximumCapacity = 30 };
        var rejected = new Boat { Id = Guid.NewGuid(), OwnerId = pending.OwnerId, Name = "Rejected registration", RegistrationNumber = "APPROVAL-REJECTED", Approval = ApprovalStatus.Rejected };
        var approvedPatrol = new Boat { Id = Guid.NewGuid(), OwnerId = test.Users[PortalRoles.Ops], Name = "Approved patrol", RegistrationNumber = "APPROVAL-PATROL-YES", IsPatrolBoat = true, Approval = ApprovalStatus.Approved, GpsDeviceId = "TEST-APPROVED-PATROL" };
        var pendingPatrol = new Boat { Id = Guid.NewGuid(), OwnerId = approvedPatrol.OwnerId, Name = "Pending patrol", RegistrationNumber = "APPROVAL-PATROL-NO", IsPatrolBoat = true, GpsDeviceId = "TEST-PENDING-PATROL" };
        var legacy = new Trip { Id = Guid.NewGuid(), Boat = pending, Status = TripStatus.Scheduled, ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(3), PassengerVerificationFinalizedAtUtc = DateTimeOffset.UtcNow };
        test.Db.Boats.AddRange(pending, rejected, approvedPatrol, pendingPatrol); test.Db.Trips.Add(legacy);
        await test.Db.SaveChangesAsync(); test.Db.ChangeTracker.Clear();
        var before = await test.Db.Trips.CountAsync();
        var info = new ProcessStartInfo("node") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        info.WorkingDirectory = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../"));
        info.ArgumentList.Add("scripts/tests/boat-trip-approval.cjs");
        info.Environment["WWMS_WEB_URL"] = test.Client.BaseAddress!.ToString();
        info.Environment["WWMS_APPROVAL_FIXTURES"] = JsonSerializer.Serialize(new { boatId, pendingId = pending.Id, rejectedId = rejected.Id,
            tripId = original.Id, legacyTripId = legacy.Id, approvedPatrolId = approvedPatrol.Id, pendingPatrolId = pendingPatrol.Id });
        using var process = Process.Start(info)!;
        var output = process.StandardOutput.ReadToEndAsync(); var errors = process.StandardError.ReadToEndAsync();
        try { await process.WaitForExitAsync(new CancellationTokenSource(TimeSpan.FromMinutes(4)).Token); }
        catch (OperationCanceledException) { process.Kill(entireProcessTree: true); throw; }
        var text = await output; Console.WriteLine(text);
        Assert.True(process.ExitCode == 0, text + await errors);
        Assert.Equal(before + 1, await test.Db.Trips.CountAsync());
        Assert.Equal(TripStatus.Scheduled, (await test.Db.Trips.AsNoTracking().SingleAsync(x => x.Id == legacy.Id)).Status);
        Assert.Null((await test.Db.Trips.AsNoTracking().SingleAsync(x => x.Id == original.Id)).ActualDepartureUtc);
    }

    [SqlServerFact]
    public async Task BoatTripApproval_TransferDestinationsUseTheSamePolicy_AndAllowRecoveryFromAnUnapprovedSource()
    {
        await using var test = await Harness.CreateAsync();
        var (sourceBoat, _) = await ApprovedTripFixture(test);
        var source = await test.Db.Trips.AsNoTracking().SingleAsync(x => x.BoatId == sourceBoat && x.Status == TripStatus.Scheduled);
        await test.Db.Boats.Where(x => x.Id == sourceBoat).ExecuteUpdateAsync(s => s.SetProperty(x => x.Approval, ApprovalStatus.Rejected));
        var destinationBoat = new Boat { Id = Guid.NewGuid(), OwnerId = test.Users[PortalRoles.BoatOwner], Name = "Approval destination", RegistrationNumber = "APPROVAL-TRANSFER", MaximumCapacity = 30, WildlifeApproval = ApprovalStatus.Approved };
        var destination = new Trip { Id = Guid.NewGuid(), Boat = destinationBoat, Status = TripStatus.Scheduled, ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(5) };
        test.Db.Trips.Add(destination); await test.Db.SaveChangesAsync(); test.Db.ChangeTracker.Clear();
        var search = await test.Json(PortalRoles.BoatOwner, $"/api/operations/transfers/destination-boats?sourceTripId={source.Id}&query=Approval");
        var found = Assert.Single(search.EnumerateArray());
        Assert.Equal(destinationBoat.Id, found.GetProperty("id").GetGuid()); Assert.Equal("Approved", found.GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.OK, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Get, $"/api/operations/transfers/destination-boats/{destinationBoat.Id}/trips?sourceTripId={source.Id}")).StatusCode);
        await test.Db.Boats.Where(x => x.Id == destinationBoat.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.WildlifeApproval, ApprovalStatus.Rejected));
        var passenger = await test.Db.TripPassengers.Where(x => x.TripId == source.Id).Select(x => x.PassengerId).SingleAsync();
        object Request() => new { clientRequestId = Guid.NewGuid(), sourceTripId = source.Id, destinationTripId = destination.Id, passengerIds = new[] { passenger }, crewUserIds = Array.Empty<Guid>(), reason = "Boat unavailable" };
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Post, "/api/operations/transfers", Request())).StatusCode);
        Assert.Equal(1, await test.Db.TripPassengers.CountAsync(x => x.TripId == source.Id));
        Assert.Equal(0, await test.Db.TripPassengers.CountAsync(x => x.TripId == destination.Id));
        await test.Db.Boats.Where(x => x.Id == destinationBoat.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.WildlifeApproval, ApprovalStatus.Approved));
        Assert.Equal(HttpStatusCode.OK, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Post, "/api/operations/transfers", Request())).StatusCode);
        Assert.Equal(1, await test.Db.TripPassengers.CountAsync(x => x.TripId == destination.Id));
    }
}

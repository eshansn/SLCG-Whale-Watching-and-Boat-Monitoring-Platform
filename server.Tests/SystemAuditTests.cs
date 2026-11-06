using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Gps;
using WhaleWatching.Api.Operations;
using WhaleWatching.Api.Realtime;

namespace WhaleWatching.Api.Tests;

public sealed partial class ComplaintAccountabilityTests
{
    [SqlServerFact]
    public async Task Audit_ExplicitTripCrewCannotBeDoubleBooked()
    {
        await using var test = await Harness.CreateAsync();
        var boat = await test.Db.Boats.FirstAsync(); boat.OwnerId = test.Users[PortalRoles.BoatOwner];
        var crew = await test.Db.Users.SingleAsync(x => x.Id == test.Users[PortalRoles.BoatCrew]);
        crew.IsCrewCertified = true; crew.CrewType = "Coxswain";
        test.Db.OwnerCrewMemberships.Add(new OwnerCrewMembership { Id = Guid.NewGuid(), OwnerId = boat.OwnerId, CrewUserId = crew.Id });
        var departure = DateTimeOffset.UtcNow.AddDays(3);
        var assigned = new Trip { Id = Guid.NewGuid(), BoatId = boat.Id, Status = TripStatus.Scheduled, ScheduledDepartureUtc = departure };
        test.Db.Trips.Add(assigned);
        test.Db.TripCrewAssignments.Add(new TripCrewAssignment { Id = Guid.NewGuid(), TripId = assigned.Id, CrewUserId = crew.Id, Position = "Coxswain" });
        await test.Db.SaveChangesAsync();
        var count = await test.Db.Trips.CountAsync();
        var response = await test.Send(PortalRoles.BoatOwner, HttpMethod.Post, "/api/operations/trips", new {
            boatId = boat.Id, scheduledDepartureUtc = departure, route = "Audit route", passengerCount = 0, crewUserIds = new[] { crew.Id } });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(count, await test.Db.Trips.CountAsync());
    }

    [SqlServerFact]
    public async Task Audit_TripSchedulingValidatesCountsAndExplicitCrewAvailability()
    {
        await using var test = await Harness.CreateAsync();
        var boat = await test.Db.Boats.FirstAsync(); boat.OwnerId = test.Users[PortalRoles.BoatOwner]; boat.MaximumCapacity = 10;
        var crew = await test.Db.Users.SingleAsync(x => x.Id == test.Users[PortalRoles.BoatCrew]);
        crew.IsCrewCertified = true; crew.CrewType = "Coxswain";
        test.Db.OwnerCrewMemberships.Add(new OwnerCrewMembership { Id = Guid.NewGuid(), OwnerId = boat.OwnerId, CrewUserId = crew.Id });
        await test.Db.SaveChangesAsync();
        var departure = DateTimeOffset.UtcNow.AddDays(3);
        object Body(int passengers = 0, int children = 0, int special = 0, string route = "Audit route") =>
            new { boatId = boat.Id, scheduledDepartureUtc = departure, route, passengerCount = passengers,
                childrenCount = children, specialNeedsCount = special, crewUserIds = new[] { crew.Id } };
        var count = await test.Db.Trips.CountAsync();
        foreach (var body in new[] { Body(-1), Body(1, -1), Body(1, 0, -1), Body(route: new string('x', 301)), Body(1, 2), Body(1, 0, 2) })
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Post, "/api/operations/trips", body)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Post,
            "/api/operations/trips", Body(11))).StatusCode);
        Assert.Equal(count, await test.Db.Trips.CountAsync());
        Assert.Equal(HttpStatusCode.Created, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Post,
            "/api/operations/trips", Body(3, 1, 1))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Post,
            "/api/operations/trips", Body(3, 1, 1))).StatusCode);
        Assert.Equal(count + 1, await test.Db.Trips.CountAsync());
    }

    [SqlServerFact]
    public async Task Audit_OnlyOneTripPerBoatCanStart_IncludingConcurrentRequests()
    {
        await using var test = await Harness.CreateAsync();
        var boatId = await test.Db.Boats.Select(x => x.Id).FirstAsync();
        var trips = Enumerable.Range(0, 3).Select(i => new Trip { Id = Guid.NewGuid(), BoatId = boatId,
            Status = TripStatus.Scheduled, ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddHours(i + 1),
            PassengerVerificationFinalizedAtUtc = DateTimeOffset.UtcNow }).ToArray();
        test.Db.Trips.AddRange(trips); await test.Db.SaveChangesAsync();
        var responses = await Task.WhenAll(trips.Take(2).Select(trip => test.Send(PortalRoles.ShoreCrew,
            HttpMethod.Post, $"/api/operations/trips/{trip.Id}/start", new { confirmRescheduleOverride = false })));
        Assert.Equal(1, responses.Count(x => x.StatusCode == HttpStatusCode.NoContent));
        Assert.Equal(1, responses.Count(x => x.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.ShoreCrew, HttpMethod.Post,
            $"/api/operations/trips/{trips[2].Id}/start", new { confirmRescheduleOverride = false })).StatusCode);
        Assert.Equal(1, await test.Db.Trips.CountAsync(x => x.BoatId == boatId && x.Status == TripStatus.Ongoing));
    }

    [SqlServerFact]
    public async Task Audit_GpsBroadcastUsesTheSameOwnerCrewAndRoleScopeAsRest()
    {
        await using var test = await Harness.CreateAsync();
        var boat = await test.Db.Boats.FirstAsync();
        boat.OwnerId = test.Users[PortalRoles.BoatOwner]; boat.GpsDeviceId = "351535133742999";
        var trip = await test.Db.Trips.FirstAsync(x => x.BoatId == boat.Id);
        test.Db.TripCrewAssignments.Add(new TripCrewAssignment { Id = Guid.NewGuid(), TripId = trip.Id,
            CrewUserId = test.Users[PortalRoles.BoatCrew] });
        // REST gives owner scoping precedence even when an account also has a staff role.
        test.Db.UserRoles.AddRange(
            new IdentityUserRole<Guid> { UserId = test.Users[PortalRoles.Supervisor], RoleId = test.Roles[PortalRoles.Admin] },
            new IdentityUserRole<Guid> { UserId = test.Users[PortalRoles.Supervisor], RoleId = test.Roles[PortalRoles.BoatOwner] });
        await test.Db.SaveChangesAsync();
        var services = new ServiceCollection();
        services.AddDbContext<WhaleWatchingDbContext>(o => o.UseSqlServer(test.Db.Database.GetConnectionString()));
        services.AddScoped<GpsTelemetryIngestor>();
        var options = Options.Create(new TrackMyCarOptions { ApiKey = "fixture-only", PollIntervalSeconds = 3600 });
        services.AddScoped(sp => new TripTrackingService(sp.GetRequiredService<WhaleWatchingDbContext>(), null!, options, TimeProvider.System));
        await using var provider = services.BuildServiceProvider();
        var hub = new CapturedGpsHub();
        using var worker = new TrackMyCarSyncWorker(new AuditGpsProvider(boat.GpsDeviceId), provider.GetRequiredService<IServiceScopeFactory>(),
            hub, options, new TrackMyCarSyncState(), new GpsTrackerStatus(options, TimeProvider.System), TimeProvider.System,
            NullLogger<TrackMyCarSyncWorker>.Instance);
        await worker.StartAsync(CancellationToken.None);
        try
        {
            var delivered = await hub.Sent.Task.WaitAsync(TimeSpan.FromSeconds(10));
            var expected = new[] { PortalRoles.Admin, PortalRoles.Wildlife, PortalRoles.Ops,
                PortalRoles.ShoreCrew, PortalRoles.BoatOwner, PortalRoles.BoatCrew }
                .Select(role => $"user:{test.Users[role]}").Order().ToArray();
            Assert.Equal("gpsTelemetryUpdated", delivered.Method);
            Assert.Equal(expected, delivered.Groups.Order().ToArray());
        }
        finally { await worker.StopAsync(CancellationToken.None); }
    }

    [SqlServerFact]
    public async Task Audit_TransfersPreserveFinalizedManifestsAndAttendanceHistory()
    {
        await using var test = await Harness.CreateAsync();
        var (source, primary, _) = await SeedShoreGroup(test);
        var boat = await test.Db.Boats.SingleAsync(x => x.Id == source.BoatId);
        boat.OwnerId = test.Users[PortalRoles.BoatOwner];
        boat.Approval = ApprovalStatus.Approved;
        boat.MaximumCapacity = 30;
        var destination = new Trip { Id = Guid.NewGuid(), BoatId = boat.Id,
            Status = TripStatus.Scheduled, ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(2) };
        test.Db.Trips.Add(destination);
        var ids = await test.Db.TripPassengers.Where(x => x.TripId == source.Id).Select(x => x.PassengerId).ToArrayAsync();
        await test.Db.SaveChangesAsync();
        var body = new { clientRequestId = Guid.NewGuid(), sourceTripId = source.Id, destinationTripId = destination.Id,
            passengerIds = ids, crewUserIds = Array.Empty<Guid>(), reason = "Operational issue" };

        foreach (var finalized in new[] { source, destination })
        {
            finalized.PassengerVerificationFinalizedAtUtc = DateTimeOffset.UtcNow;
            await test.Db.SaveChangesAsync();
            Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Post,
                "/api/operations/transfers", body)).StatusCode);
            Assert.Equal(ids.Length, await test.Db.TripPassengers.CountAsync(x => x.TripId == source.Id));
            Assert.False(await test.Db.TripTransfers.AnyAsync());
            finalized.PassengerVerificationFinalizedAtUtc = null;
            await test.Db.SaveChangesAsync();
        }

        // A partially checked manifest is still open, but its check-ins must not migrate to another trip.
        await test.Ok(PortalRoles.ShoreCrew, HttpMethod.Put,
            $"/api/shore/trips/{source.Id}/attendance/groups/{primary.Id}",
            new { items = ids.Select(id => new { passengerId = id, status = id == primary.Id ? "Present" : "NotChecked" }) });
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Post,
            "/api/operations/transfers", body)).StatusCode);
        Assert.Equal(source.Id, await test.Db.TripPassengerAttendances.Select(x => x.TripPassenger.TripId).SingleAsync());
        Assert.Equal(source.Id, await test.Db.PassengerAttendanceAudits.Select(x => x.Attendance.TripPassenger.TripId).SingleAsync());
        Assert.False(await test.Db.TripTransfers.AnyAsync());
    }

    [SqlServerFact]
    public async Task Audit_TransfersKeepQrGroupsTogether_AndWholeGroupRemainsVerifiable()
    {
        await using var test = await Harness.CreateAsync();
        var (source, primary, qr) = await SeedShoreGroup(test);
        var boat = await test.Db.Boats.SingleAsync(x => x.Id == source.BoatId);
        boat.OwnerId = test.Users[PortalRoles.BoatOwner]; boat.Approval = ApprovalStatus.Approved; boat.MaximumCapacity = 30;
        var destination = new Trip { Id = Guid.NewGuid(), BoatId = boat.Id,
            Status = TripStatus.Scheduled, ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(2) };
        test.Db.Trips.Add(destination); await test.Db.SaveChangesAsync();
        var ids = await test.Db.TripPassengers.Where(x => x.TripId == source.Id).Select(x => x.PassengerId).ToArrayAsync();
        foreach (var id in ids)
        {
            var response = await test.Send(PortalRoles.BoatOwner, HttpMethod.Post, "/api/operations/transfers", new {
                clientRequestId = Guid.NewGuid(), sourceTripId = source.Id, destinationTripId = destination.Id,
                passengerIds = new[] { id }, crewUserIds = Array.Empty<Guid>(), reason = "Operational issue" });
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.False(await test.Db.TripTransfers.AnyAsync());
        }
        await test.Ok(PortalRoles.BoatOwner, HttpMethod.Post, "/api/operations/transfers", new {
            clientRequestId = Guid.NewGuid(), sourceTripId = source.Id, destinationTripId = destination.Id,
            passengerIds = ids, crewUserIds = Array.Empty<Guid>(), reason = "Operational issue" });
        var scan = await test.Ok(PortalRoles.ShoreCrew, HttpMethod.Post,
            $"/api/shore/trips/{destination.Id}/attendance/scan", new { qrValue = qr });
        var group = await scan.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(primary.Id, group.GetProperty("primaryPassengerId").GetGuid());
        Assert.Equal(ids.Length, group.GetProperty("members").GetArrayLength());
        Assert.Equal(0, await test.Db.TripPassengers.CountAsync(x => x.TripId == source.Id));
    }

    [SqlServerFact]
    public async Task Audit_WildlifeCannotResetDeleteOrReadMixedPrivilegedStaff()
    {
        await using var test = await Harness.CreateAsync();
        var id = test.Users[PortalRoles.Admin];
        test.Db.UserRoles.Add(new IdentityUserRole<Guid> { UserId = id, RoleId = test.Roles[PortalRoles.Supervisor] });
        await test.Db.SaveChangesAsync();
        var before = await test.Db.Users.AsNoTracking().SingleAsync(x => x.Id == id);
        Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(PortalRoles.Wildlife, HttpMethod.Post,
            $"/api/admin/staff/{id}/reset-password", new { temporaryPassword = "Temporary#2026!Audit" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(PortalRoles.Wildlife, HttpMethod.Delete,
            $"/api/admin/staff/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await test.Send(PortalRoles.Wildlife, HttpMethod.Get,
            $"/api/admin/staff/{id}")).StatusCode);
        var list = await test.Json(PortalRoles.Wildlife, "/api/admin/staff");
        Assert.DoesNotContain(list.EnumerateArray(), x => x.GetProperty("id").GetGuid() == id);
        var after = await test.Db.Users.AsNoTracking().SingleAsync(x => x.Id == id);
        Assert.Equal(before.PasswordHash, after.PasswordHash); Assert.Equal(before.SecurityStamp, after.SecurityStamp);
        // Wildlife still manages the existing Supervisor and Harbour Officer accounts.
        foreach (var role in new[] { PortalRoles.Supervisor, PortalRoles.HarbourOfficer })
            await test.Ok(PortalRoles.Wildlife, HttpMethod.Post, $"/api/admin/staff/{test.Users[role]}/reset-password",
                new { temporaryPassword = "Temporary#2026!Audit" });
    }

    private sealed class AuditGpsProvider(string deviceId) : IGpsProvider
    {
        public Task<GpsLocationBatch> GetLatestLocationsAsync(CancellationToken cancellationToken) => Task.FromResult(
            new GpsLocationBatch(1, 0, [new GpsPosition(deviceId, 6, 80, 10, 0, 1, DateTimeOffset.UtcNow, new Dictionary<string, string>())]));
        public Task<IReadOnlyList<GpsProviderObject>> GetObjectsAsync(CancellationToken ct) => throw new NotSupportedException();
        public Task<GpsRoute> GetRouteAsync(string id, DateTimeOffset from, DateTimeOffset to, int minimum, CancellationToken ct) => throw new NotSupportedException();
        public Task<GpsLocationBatch> GetMessagesAsync(string id, DateTimeOffset from, DateTimeOffset to, CancellationToken ct) => throw new NotSupportedException();
        public Task<IReadOnlyList<GpsProviderEvent>> GetEventsAsync(string id, DateTimeOffset from, DateTimeOffset to, CancellationToken ct) => throw new NotSupportedException();
        public Task<IReadOnlyList<GpsProviderEvent>> GetLastEventsAsync(bool sevenDays, CancellationToken ct) => throw new NotSupportedException();
    }

    private sealed class CapturedGpsHub : IHubContext<OperationsHub>, IHubClients
    {
        public TaskCompletionSource<(string Method, string[] Groups)> Sent { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        IHubClients IHubContext<OperationsHub>.Clients => this;
        IGroupManager IHubContext<OperationsHub>.Groups => throw new NotSupportedException();
        public IClientProxy All => new CaptureProxy(this, ["*"]);
        public IClientProxy Groups(IReadOnlyList<string> groupNames) => new CaptureProxy(this, groupNames.ToArray());
        public IClientProxy Group(string groupName) => new CaptureProxy(this, [groupName]);
        public IClientProxy Client(string id) => throw new NotSupportedException();
        public IClientProxy Clients(IReadOnlyList<string> ids) => throw new NotSupportedException();
        public IClientProxy AllExcept(IReadOnlyList<string> ids) => throw new NotSupportedException();
        public IClientProxy GroupExcept(string name, IReadOnlyList<string> ids) => throw new NotSupportedException();
        public IClientProxy User(string id) => throw new NotSupportedException();
        public IClientProxy Users(IReadOnlyList<string> ids) => throw new NotSupportedException();
        private sealed class CaptureProxy(CapturedGpsHub hub, string[] groups) : IClientProxy
        {
            public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default)
            { hub.Sent.TrySetResult((method, groups)); return Task.CompletedTask; }
        }
    }
}

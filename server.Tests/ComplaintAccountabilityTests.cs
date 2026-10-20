using System.IdentityModel.Tokens.Jwt;
using System.Diagnostics;
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
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Complaints;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Tests;

public sealed class ComplaintAccountabilityTests
{
    [Theory]
    [InlineData(ComplaintStatus.Submitted, ComplaintStatus.UnderReview, true, true)]
    [InlineData(ComplaintStatus.Submitted, ComplaintStatus.Closed, false, false)]
    [InlineData(ComplaintStatus.Responded, ComplaintStatus.Resolved, true, false)]
    [InlineData(ComplaintStatus.Responded, ComplaintStatus.Resolved, false, true)]
    [InlineData(ComplaintStatus.Resolved, ComplaintStatus.Closed, false, true)]
    [InlineData(ComplaintStatus.Closed, ComplaintStatus.Reopened, false, true)]
    [InlineData(ComplaintStatus.Forwarded, ComplaintStatus.Resolved, true, false)]
    public void OverallTransitions_RequireReviewExplicitClosureAndCompletedAssignments(ComplaintStatus from, ComplaintStatus to, bool pending, bool permitted) =>
        Assert.Equal(permitted, ComplaintRules.CanTransition(from, to, pending));

    [Fact]
    public void Aggregate_DoesNotResolveOnForwardingOrPartialResponses()
    {
        Assert.Equal(ComplaintStatus.Forwarded, ComplaintRules.Aggregate([ComplaintAssignmentStatus.Pending, ComplaintAssignmentStatus.Acknowledged]));
        Assert.Equal(ComplaintStatus.InProgress, ComplaintRules.Aggregate([ComplaintAssignmentStatus.Pending, ComplaintAssignmentStatus.Responded]));
        Assert.Equal(ComplaintStatus.Responded, ComplaintRules.Aggregate([ComplaintAssignmentStatus.Responded, ComplaintAssignmentStatus.Responded]));
        Assert.False(ComplaintRules.CanUpdateAssignment(ComplaintAssignmentStatus.Pending, ComplaintAssignmentStatus.Responded));
        Assert.True(ComplaintRules.CanUpdateAssignment(ComplaintAssignmentStatus.Responded, ComplaintAssignmentStatus.Responded));
    }

    [SqlServerFact]
    public async Task HttpWorkflow_MultiAuthorityNotificationsResponsesClosureAndReopeningPersist()
    {
        await using var test = await Harness.CreateAsync();
        var id = test.ComplaintId;
        var monitor = PortalRoles.Sltda;
        await test.Action(monitor, id, "status", status: "UnderReview", text: "Reviewed for referral");
        var forward = await test.Command(id, "forward", roles: [test.Roles[PortalRoles.Ops], test.Roles[PortalRoles.Wildlife]], note: "Please investigate");
        var first = await test.Send(monitor, HttpMethod.Post, $"/api/complaint-workflow/{id}/actions", forward);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var replay = await test.Send(monitor, HttpMethod.Post, $"/api/complaint-workflow/{id}/actions", forward);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        Assert.Equal(1, await test.Db.PassengerComplaints.CountAsync());
        var assignments = await test.Db.ComplaintAssignments.AsNoTracking().OrderBy(x => x.Id).ToListAsync();
        Assert.Equal(2, assignments.Count);
        Assert.Equal(ComplaintStatus.Forwarded, (await test.Current(id)).Status);
        var opsAssignment = assignments.Single(x => x.AuthorityRoleId == test.Roles[PortalRoles.Ops]);
        var wildlifeAssignment = assignments.Single(x => x.AuthorityRoleId == test.Roles[PortalRoles.Wildlife]);
        var opsNotices = await test.Json(PortalRoles.Ops, "/api/complaint-notifications");
        var notice = Assert.Single(opsNotices.GetProperty("items").EnumerateArray());
        Assert.Equal(opsAssignment.Id, notice.GetProperty("assignmentId").GetGuid());
        Assert.Equal(1, opsNotices.GetProperty("unread").GetInt32());
        Assert.Equal("Safety concern", notice.GetProperty("category").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await test.Send(PortalRoles.Ops, HttpMethod.Post, $"/api/complaint-workflow/{id}/actions",
            await test.Command(id, "assignment", assignment: wildlifeAssignment.Id, status: "Acknowledged"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.Ops, HttpMethod.Post, $"/api/complaint-workflow/{id}/actions",
            await test.Command(id, "assignment", assignment: opsAssignment.Id, status: "Responded", text: "Cannot skip acknowledgment"))).StatusCode);
        Assert.Single((await test.Json(PortalRoles.Wildlife, "/api/complaint-notifications")).GetProperty("items").EnumerateArray());
        Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(PortalRoles.ShoreCrew, HttpMethod.Get, "/api/complaint-notifications")).StatusCode);
        await test.Ok(PortalRoles.Ops, HttpMethod.Put, $"/api/complaint-notifications/{notice.GetProperty("id").GetGuid()}/read", new { read = true });
        Assert.Equal(0, (await test.Json(PortalRoles.Ops, "/api/complaint-notifications/unread-count")).GetProperty("unread").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await test.Send(PortalRoles.Wildlife, HttpMethod.Put,
            $"/api/complaint-notifications/{notice.GetProperty("id").GetGuid()}/read", new { read = true })).StatusCode);
        foreach (var (role, assignment) in new[] { (PortalRoles.Ops, opsAssignment), (PortalRoles.Wildlife, wildlifeAssignment) })
        {
            await test.Action(role, id, "assignment", assignment: assignment.Id, status: "Acknowledged");
            await test.Action(role, id, "assignment", assignment: assignment.Id, status: "InProgress", text: $"{role} investigation started");
            await test.Action(role, id, "assignment", assignment: assignment.Id, status: "Responded", text: $"{role} official response");
        }
        await test.Action(PortalRoles.Ops, id, "assignment", assignment: opsAssignment.Id, status: "Responded", text: "Follow-up response preserved");
        Assert.Equal(ComplaintStatus.Responded, (await test.Current(id)).Status);
        var detail = await test.Json(monitor, $"/api/complaint-workflow/{id}");
        Assert.Equal(2, detail.GetProperty("assignments").GetArrayLength());
        Assert.Equal(3, await test.Db.ComplaintEvents.CountAsync(x => x.Action == "Authority update" && x.AssignmentId == opsAssignment.Id));
        var opsDetail = await test.Json(PortalRoles.Ops, $"/api/complaint-workflow/{id}");
        Assert.Single(opsDetail.GetProperty("assignments").EnumerateArray());
        Assert.All(opsDetail.GetProperty("timeline").EnumerateArray(), e => Assert.Equal(opsAssignment.Id, e.GetProperty("assignmentId").GetGuid()));
        Assert.Equal(JsonValueKind.Null, opsDetail.GetProperty("complaint").GetProperty("contact").ValueKind);
        Assert.True((await test.Json(PortalRoles.Admin, "/api/complaint-notifications/unread-count")).GetProperty("unread").GetInt32() >= 9);
        await test.Action(PortalRoles.Admin, id, "status", status: "Resolved", text: "Both authorities responded");
        await test.Action(monitor, id, "status", status: "Closed", text: "Closure confirmed");
        Assert.Equal(ComplaintStatus.Closed, (await test.Current(id)).Status);
        await test.Action(monitor, id, "status", status: "Reopened", text: "Further investigation required");
        Assert.All(await test.Db.ComplaintAssignments.AsNoTracking().ToListAsync(), a => Assert.Equal(ComplaintAssignmentStatus.InProgress, a.Status));
        Assert.Equal(2, await test.Db.ComplaintEvents.CountAsync(x => x.Action == "Further action required"));
        Assert.Equal(1, await test.Db.PassengerComplaints.CountAsync());
    }

    [SqlServerFact]
    public async Task ReceivingAuthorities_IncludeOnlyOpsAdminWildlifeSltdaAndHarbour_WithIndependentResponses()
    {
        await using var test = await Harness.CreateAsync();
        var id = test.ComplaintId;
        var expected = new[] { PortalRoles.Ops, PortalRoles.Admin, PortalRoles.Wildlife, PortalRoles.Sltda, PortalRoles.HarbourOfficer };
        var available = (await test.Json(PortalRoles.Admin, "/api/complaint-workflow/authorities"))
            .EnumerateArray().Select(x => x.GetProperty("name").GetString()).Order().ToArray();
        Assert.Equal(expected.Order(), available);
        foreach (var role in new[] { PortalRoles.ShoreCrew, PortalRoles.ShoreWildlife, PortalRoles.Supervisor })
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(role, HttpMethod.Get, "/api/complaint-workflow")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(role, HttpMethod.Get, "/api/complaint-notifications")).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(PortalRoles.Admin, HttpMethod.Post, $"/api/complaint-workflow/{id}/actions",
                await test.Command(id, "forward", roles: [test.Roles[role]]))).StatusCode);
        }
        await test.Action(PortalRoles.Sltda, id, "forward", roles: expected.Select(r => test.Roles[r]).ToArray());
        var assignments = await test.Db.ComplaintAssignments.AsNoTracking().ToListAsync();
        Assert.Equal(5, assignments.Count);
        Assert.Equal(5, await test.Db.ComplaintNotifications.CountAsync()); // Monitors get their assignment notice, without an extra duplicate.
        foreach (var role in expected)
        {
            var assignment = assignments.Single(x => x.AuthorityRoleId == test.Roles[role]);
            var details = await test.Json(role, $"/api/complaint-workflow/{id}");
            var permitted = details.GetProperty("assignments").EnumerateArray().Where(x => x.GetProperty("canRespond").GetBoolean()).ToArray();
            Assert.Equal(assignment.Id, Assert.Single(permitted).GetProperty("id").GetGuid());
            await test.Action(role, id, "assignment", assignment: assignment.Id, status: "Acknowledged");
            await test.Action(role, id, "assignment", assignment: assignment.Id, status: "Responded", text: $"Official {role} handling response");
        }
        Assert.Equal(ComplaintStatus.Responded, (await test.Current(id)).Status);
        Assert.Equal(1, await test.Db.PassengerComplaints.CountAsync());
    }

    [SqlServerFact]
    public async Task StaffManagement_HttpRequestsBindValidateAndPersistWithoutServerErrors()
    {
        await using var test = await Harness.CreateAsync();
        var roleNames = WhaleWatching.Api.Admin.StaffController.StaffRoles;
        foreach (var role in roleNames)
        {
            var request = new WhaleWatching.Api.Admin.CreateStaffRequest($"New {role} officer", $"new-{role}",
                $"new-{role.ToLowerInvariant()}@staff-test.example", role, "StaffTest#2026!Only", "+94771234567");
            using var created = await test.Ok(PortalRoles.Admin, HttpMethod.Post, "/api/admin/staff", request);
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            Assert.NotNull(created.Headers.Location);
            var user = await created.Content.ReadFromJsonAsync<WhaleWatching.Api.Admin.StaffDto>();
            Assert.Equal(role, user!.Role);
            var persisted = await test.Db.Users.AsNoTracking().SingleAsync(x => x.Id == user.Id);
            Assert.Equal(request.Email, persisted.Email);
            Assert.True(await test.Db.UserRoles.AnyAsync(x => x.UserId == user.Id && x.RoleId == test.Roles[role]));
            Assert.Equal(HttpStatusCode.OK, (await test.Send(PortalRoles.Admin, HttpMethod.Get, created.Headers.Location!.ToString())).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.Admin, HttpMethod.Post, "/api/admin/staff", request)).StatusCode);

            var update = new WhaleWatching.Api.Admin.UpdateStaffRequest($"Updated {role} officer", request.UserName,
                request.Email, role, "+94777654321", true);
            await test.Ok(PortalRoles.Admin, HttpMethod.Patch, $"/api/admin/staff/{user.Id}", update);
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(PortalRoles.Admin, HttpMethod.Patch,
                $"/api/admin/staff/{user.Id}", update with { Email = "invalid-email" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(PortalRoles.Admin, HttpMethod.Post,
                $"/api/admin/staff/{user.Id}/reset-password", new { temporaryPassword = "short" })).StatusCode);
            await test.Ok(PortalRoles.Admin, HttpMethod.Post, $"/api/admin/staff/{user.Id}/reset-password",
                new { temporaryPassword = "Replacement#2026!Only" });
        }
        var before = await test.Db.Users.CountAsync();
        var invalid = new WhaleWatching.Api.Admin.CreateStaffRequest("Invalid test", "invalid-test", "invalid-email", PortalRoles.Sltda, "short", new string('1', 33));
        using var rejected = await test.Send(PortalRoles.Admin, HttpMethod.Post, "/api/admin/staff", invalid);
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        var problem = await rejected.Content.ReadFromJsonAsync<JsonElement>();
        var fields = problem.GetProperty("errors");
        Assert.True(fields.TryGetProperty("Email", out _));
        Assert.True(fields.TryGetProperty("Password", out _));
        Assert.True(fields.TryGetProperty("PhoneNumber", out _));
        Assert.Equal(before, await test.Db.Users.CountAsync());
        Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(PortalRoles.Wildlife, HttpMethod.Post, "/api/admin/staff",
            invalid with { Email = "valid@staff-test.example", Password = "StaffTest#2026!Only", PhoneNumber = null })).StatusCode);
    }

    [SqlServerFact]
    public async Task DirectHttpAuthorization_RejectsUnrelatedAssignmentsStaleRolesAndOperationalWrites()
    {
        await using var test = await Harness.CreateAsync();
        var id = test.ComplaintId;
        Assert.Equal(HttpStatusCode.Unauthorized, (await test.Send(null, HttpMethod.Get, "/api/passenger-monitoring/passengers")).StatusCode);
        foreach (var role in new[] { PortalRoles.BoatOwner, PortalRoles.Passenger, PortalRoles.Wildlife, PortalRoles.Ops })
            Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(role, HttpMethod.Get, "/api/passenger-monitoring/passengers")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(PortalRoles.Sltda, HttpMethod.Post, "/api/admin/staff", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(PortalRoles.Wildlife, HttpMethod.Get, "/api/complaints")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(PortalRoles.Sltda, HttpMethod.Post, "/api/operations/boats", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(PortalRoles.Sltda, HttpMethod.Get, $"/api/operations/trips/{Guid.NewGuid()}/crew")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await test.Send(PortalRoles.Ops, HttpMethod.Get, $"/api/complaint-workflow/{id}")).StatusCode);
        await test.Action(PortalRoles.Admin, id, "forward", roles: [test.Roles[PortalRoles.Ops]]);
        var assignment = await test.Db.ComplaintAssignments.AsNoTracking().SingleAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await test.Send(PortalRoles.Wildlife, HttpMethod.Get, $"/api/complaint-workflow/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await test.Send(PortalRoles.Wildlife, HttpMethod.Post, $"/api/complaint-workflow/{id}/actions",
            await test.Command(id, "assignment", assignment: assignment.Id, status: "Acknowledged"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(PortalRoles.Ops, HttpMethod.Post, $"/api/complaint-workflow/{id}/actions",
            await test.Command(id, "forward", roles: [test.Roles[PortalRoles.Wildlife]]))).StatusCode);
        var membership = await test.Db.UserRoles.SingleAsync(x => x.UserId == test.Users[PortalRoles.Sltda]);
        test.Db.UserRoles.Remove(membership); await test.Db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(PortalRoles.Sltda, HttpMethod.Get, "/api/passenger-monitoring/passengers")).StatusCode);
    }

    [SqlServerFact]
    public async Task Analytics_UsesColomboDaysRealClassificationZeroBucketsAndMatchingDrillDowns()
    {
        await using var test = await Harness.CreateAsync();
        static DateTimeOffset Utc(string value) => DateTimeOffset.Parse(value);
        var passengers = await test.Db.PassengerProfiles.OrderBy(x => x.Name).ToListAsync();
        passengers[0].CreatedAtUtc = Utc("2026-10-17T18:29:59Z"); // Outside Oct 18 in Colombo.
        passengers[1].CreatedAtUtc = Utc("2026-10-17T18:30:00Z");
        passengers[2].CreatedAtUtc = Utc("2026-10-19T18:30:00Z");
        var registrations = await test.Db.TripPassengers.OrderBy(x => x.Id).ToListAsync();
        registrations[0].RegisteredAtUtc = Utc("2026-10-17T18:30:00Z");
        registrations[1].RegisteredAtUtc = Utc("2026-10-19T18:30:00Z");
        var trips = await test.Db.Trips.OrderBy(x => x.Status).ToListAsync();
        trips[0].ScheduledDepartureUtc = Utc("2026-10-18T00:00:00Z");
        trips[1].ScheduledDepartureUtc = Utc("2026-10-20T00:00:00Z");
        var complaint = await test.Db.PassengerComplaints.SingleAsync();
        complaint.CreatedAtUtc = Utc("2026-10-18T05:00:00Z");
        test.Db.PassengerComplaints.AddRange(
            new PassengerComplaint { Id = Guid.NewGuid(), PassengerId = complaint.PassengerId, TripId = complaint.TripId,
                Kind = "Inquiry", Type = "Other", Message = "Information request", Status = ComplaintStatus.Resolved, CreatedAtUtc = Utc("2026-10-19T18:30:00Z") },
            new PassengerComplaint { Id = Guid.NewGuid(), PassengerId = complaint.PassengerId, TripId = complaint.TripId,
                Kind = "Legacy unknown", Type = "Other", Message = "Unknown historic classification", Status = ComplaintStatus.Closed, CreatedAtUtc = Utc("2026-10-19T00:00:00Z") });
        await test.Db.SaveChangesAsync();
        const string range = "from=2026-10-18&to=2026-10-20";
        var daily = await test.Json(PortalRoles.Sltda, $"/api/passenger-monitoring/analytics?{range}&interval=daily");
        var totals = daily.GetProperty("totals");
        foreach (var (field, value) in new[] { ("totalPassengers", 3), ("newPassengers", 2), ("registrations", 2), ("trips", 2),
                     ("completedTrips", 1), ("complaints", 1), ("inquiries", 1), ("unclassified", 1), ("cases", 3), ("openCases", 1), ("resolved", 1), ("closed", 1) })
            Assert.Equal(value, totals.GetProperty(field).GetInt32());
        var points = daily.GetProperty("trends").EnumerateArray().ToArray();
        Assert.Equal(3, points.Length);
        Assert.Equal(1, points[0].GetProperty("passengers").GetInt32());
        Assert.Equal(0, points[1].GetProperty("passengers").GetInt32());
        Assert.Equal(1, points[2].GetProperty("inquiries").GetInt32());
        Assert.Equal(1, points[1].GetProperty("unclassified").GetInt32());
        Assert.Equal(3, daily.GetProperty("statusDistribution").EnumerateArray().Sum(x => x.GetProperty("count").GetInt32()));
        var weekly = await test.Json(PortalRoles.Admin, $"/api/passenger-monitoring/analytics?{range}&interval=weekly");
        Assert.Equal(2, weekly.GetProperty("trends").GetArrayLength());
        Assert.Equal("2026-10-18", weekly.GetProperty("trends")[0].GetProperty("start").GetString());
        Assert.Equal("2026-10-18", weekly.GetProperty("trends")[0].GetProperty("end").GetString());
        Assert.Equal(1, (await test.Json(PortalRoles.Sltda, $"/api/passenger-monitoring/analytics?{range}&interval=monthly")).GetProperty("trends").GetArrayLength());
        var empty = await test.Json(PortalRoles.Sltda, "/api/passenger-monitoring/analytics?from=2026-10-15&to=2026-10-16");
        Assert.Equal(0, empty.GetProperty("totals").GetProperty("cases").GetInt32());
        Assert.Equal(2, empty.GetProperty("trends").GetArrayLength());
        Assert.All(empty.GetProperty("trends").EnumerateArray(), p => Assert.Equal(0, p.GetProperty("passengers").GetInt32()));
        Assert.Equal(2, (await test.Json(PortalRoles.Sltda, $"/api/passenger-monitoring/passengers?{range}")).GetProperty("total").GetInt32());
        var history = await test.Json(PortalRoles.Sltda, $"/api/passenger-monitoring/trips?{range}&pageSize=1");
        Assert.Equal(2, history.GetProperty("total").GetInt32());
        Assert.Single(history.GetProperty("items").EnumerateArray());
        const string caseRange = "from=2026-10-17T18%3A30%3A00Z&to=2026-10-20T18%3A30%3A00Z";
        foreach (var (filter, count) in new[] { ("queue=open", 1), ("queue=completed", 2), ("kind=Inquiry", 1), ("kind=Unclassified", 1) })
            Assert.Equal(count, (await test.Json(PortalRoles.Sltda, $"/api/complaint-workflow?{caseRange}&{filter}")).GetProperty("total").GetInt32());
        foreach (var path in new[] { "/api/passenger-monitoring/analytics", "/api/passenger-monitoring/trips" })
            Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(PortalRoles.Wildlife, HttpMethod.Get, path)).StatusCode);
        foreach (var query in new[] { "from=2026-10-20&to=2026-10-18", "from=2024-01-01&to=2026-10-20", "interval=invalid", "from=invalid", "to=9999-12-30", "from=0001-01-01&to=0001-01-02" })
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(PortalRoles.Sltda, HttpMethod.Get, $"/api/passenger-monitoring/analytics?{query}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(PortalRoles.Sltda, HttpMethod.Get, "/api/passenger-monitoring/trips?pageSize=101")).StatusCode);
        var boat = await test.Db.Boats.SingleAsync(); boat.IsDeleted = true; await test.Db.SaveChangesAsync();
        Assert.Equal(2, (await test.Json(PortalRoles.Sltda, $"/api/passenger-monitoring/trips?{range}")).GetProperty("total").GetInt32());
    }

    [SqlServerFact]
    public async Task Monitoring_UsesAllPassengersTripHistoryInquirySubmissionFiltersAndLiveCounts()
    {
        await using var test = await Harness.CreateAsync();
        var role = PortalRoles.Sltda;
        var passengers = await test.Json(role, "/api/passenger-monitoring/passengers?pageSize=1&sort=name");
        Assert.Equal(3, passengers.GetProperty("total").GetInt32());
        Assert.Single(passengers.GetProperty("items").EnumerateArray());
        Assert.Equal(1, (await test.Json(role, "/api/passenger-monitoring/passengers?search=MONITOR-ID-1")).GetProperty("total").GetInt32());
        Assert.Equal(0, (await test.Json(role, "/api/passenger-monitoring/passengers?search=absent")).GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(role, HttpMethod.Get, "/api/passenger-monitoring/passengers?page=0&pageSize=999")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(role, HttpMethod.Get, "/api/complaint-workflow?status=Invented")).StatusCode);
        var trips = await test.Json(role, $"/api/passenger-monitoring/passengers/{test.PassengerId}/trips");
        Assert.Equal(2, trips.GetProperty("total").GetInt32());
        Assert.Contains(trips.GetProperty("items").EnumerateArray(), x => x.GetProperty("status").GetString() == "Completed");
        var tripId = trips.GetProperty("items")[0].GetProperty("tripId").GetGuid();
        Assert.Equal(1, (await test.Json(role, $"/api/passenger-monitoring/trips/{tripId}")).GetProperty("participants").GetProperty("total").GetInt32());
        // Existing passenger-session submission remains live and now supports inquiry records.
        using var form = new MultipartFormDataContent { { new StringContent("Other"), "Type" }, { new StringContent("Inquiry"), "Kind" }, { new StringContent("Trip participation inquiry"), "Message" } };
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/complaints") { Content = form };
        request.Headers.Add("X-Passenger-Session", "test-passenger-session");
        Assert.Equal(HttpStatusCode.Created, (await test.Client.SendAsync(request)).StatusCode);
        var submissionId = Guid.NewGuid();
        async Task<HttpResponseMessage> Submit(string message)
        {
            using var body = new MultipartFormDataContent { { new StringContent("Other"), "Type" }, { new StringContent("Inquiry"), "Kind" },
                { new StringContent(message), "Message" }, { new StringContent(submissionId.ToString()), "RequestId" } };
            using var post = new HttpRequestMessage(HttpMethod.Post, "/api/complaints") { Content = body };
            post.Headers.Add("X-Passenger-Session", "test-passenger-session");
            return await test.Client.SendAsync(post);
        }
        var submitted = await Task.WhenAll(Submit("Retry-safe inquiry"), Submit("Retry-safe inquiry"));
        Assert.All(submitted, response => Assert.True(response.IsSuccessStatusCode));
        Assert.Equal(HttpStatusCode.OK, (await Submit("Retry-safe inquiry")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Submit("Changed inquiry payload")).StatusCode);
        Assert.Equal(1, await test.Db.PassengerComplaints.CountAsync(x => x.Id == submissionId));
        Assert.Equal(2, await test.Db.ComplaintNotifications.CountAsync(x => x.Event.ComplaintId == submissionId));
        var cases = await test.Json(role, $"/api/complaint-workflow?passengerId={test.PassengerId}");
        Assert.Equal(3, cases.GetProperty("total").GetInt32());
        Assert.Contains(cases.GetProperty("items").EnumerateArray(), x => x.GetProperty("kind").GetString() == "Inquiry");
        var dashboard = await test.Json(role, "/api/passenger-monitoring/dashboard");
        Assert.Equal(3, dashboard.GetProperty("passengers").GetInt32());
        Assert.Equal(2, dashboard.GetProperty("trips").GetInt32());
        Assert.Equal(1, dashboard.GetProperty("completedTrips").GetInt32());
        Assert.Equal(2, dashboard.GetProperty("registrations").GetInt32());
        Assert.Equal(1, dashboard.GetProperty("complaints").GetInt32());
        Assert.Equal(2, dashboard.GetProperty("inquiries").GetInt32());
        Assert.Equal(3, dashboard.GetProperty("awaitingReview").GetInt32());
        var boat = await test.Db.Boats.SingleAsync(); boat.IsDeleted = true; await test.Db.SaveChangesAsync();
        Assert.Equal(2, (await test.Json(role, $"/api/passenger-monitoring/passengers/{test.PassengerId}/trips")).GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.OK, (await test.Send(role, HttpMethod.Get, $"/api/complaint-workflow/{test.ComplaintId}")).StatusCode);
    }

    [SqlServerFact]
    public async Task InvalidDuplicateConcurrentAndFailedOperations_DoNotLeavePartialWorkflowData()
    {
        await using var test = await Harness.CreateAsync();
        var id = test.ComplaintId;
        var role = PortalRoles.Sltda;
        var initial = await test.Current(id);
        foreach (var roles in new[] { new[] { Guid.NewGuid() }, new[] { test.Roles[PortalRoles.BoatOwner] }, Array.Empty<Guid>() })
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(role, HttpMethod.Post, $"/api/complaint-workflow/{id}/actions", await test.Command(id, "forward", roles: roles))).StatusCode);
        var opsUser = await test.Db.Users.FindAsync(test.Users[PortalRoles.Ops]);
        opsUser!.LockoutEnd = DateTimeOffset.MaxValue; await test.Db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(role, HttpMethod.Post, $"/api/complaint-workflow/{id}/actions", await test.Command(id, "forward", roles: [test.Roles[PortalRoles.Ops]]))).StatusCode);
        opsUser.LockoutEnd = null; await test.Db.SaveChangesAsync();
        test.Failure.FailNextSave = true;
        Assert.Equal(HttpStatusCode.InternalServerError, (await test.Send(role, HttpMethod.Post, $"/api/complaint-workflow/{id}/actions", await test.Command(id, "forward", roles: [test.Roles[PortalRoles.Ops]]))).StatusCode);
        Assert.Empty(await test.Db.ComplaintAssignments.AsNoTracking().ToListAsync());
        Assert.Empty(await test.Db.ComplaintNotifications.AsNoTracking().ToListAsync());
        Assert.Equal(initial.Version, (await test.Current(id)).Version);
        var command = await test.Command(id, "forward", roles: [test.Roles[PortalRoles.Ops], test.Roles[PortalRoles.Ops]]);
        var path = $"/api/complaint-workflow/{id}/actions";
        var simultaneous = await Task.WhenAll(test.Send(role, HttpMethod.Post, path, command), test.Send(role, HttpMethod.Post, path, command));
        Assert.All(simultaneous, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        Assert.Equal(1, await test.Db.ComplaintAssignments.CountAsync());
        Assert.Equal(3, await test.Db.ComplaintNotifications.CountAsync()); // OPS, Admin, SLTDA
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(role, HttpMethod.Post, path, command with { Note = "Different payload" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(role, HttpMethod.Post, path,
            new ComplaintCommand(Guid.NewGuid(), initial.Version, "status", Status: "UnderReview", Text: "Stale review"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(role, HttpMethod.Post, path, await test.Command(id, "forward", roles: [test.Roles[PortalRoles.Ops]]))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(role, HttpMethod.Post, path, await test.Command(id, "status", status: "Resolved", text: "Premature"))).StatusCode);
    }

    [SqlServerFact]
    public async Task Migration_UpgradesExistingComplaintWithoutLosingPassengerOrTripRecords()
    {
        var connection = Harness.Connection();
        await using var db = new WhaleWatchingDbContext(new DbContextOptionsBuilder<WhaleWatchingDbContext>().UseSqlServer(connection).Options);
        try
        {
            await db.GetService<IMigrator>().MigrateAsync("20261008042311_CrewProfileCertificates");
            var (passenger, trip) = await Harness.SeedPassengerAndTrips(db);
            var id = Guid.NewGuid(); var created = DateTimeOffset.UtcNow.AddDays(-10);
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO PassengerComplaints (Id,PassengerId,TripId,Type,Message,CreatedAtUtc) VALUES ({id},{passenger.Id},{trip.Id},{"Other"},{"Legacy report"},{created})");
            await db.Database.MigrateAsync();
            var upgraded = await db.PassengerComplaints.SingleAsync();
            Assert.Equal(id, upgraded.Id); Assert.Equal("Complaint", upgraded.Kind); Assert.Equal(ComplaintStatus.Submitted, upgraded.Status);
            Assert.NotEqual(Guid.Empty, upgraded.Version); Assert.Equal(created, upgraded.UpdatedAtUtc);
            Assert.Equal(created, (await db.ComplaintEvents.SingleAsync()).CreatedAtUtc);
            Assert.Equal(3, await db.PassengerProfiles.CountAsync()); Assert.Equal(2, await db.Trips.CountAsync());
            Assert.Empty(await db.ComplaintAssignments.ToListAsync());
            await db.Database.MigrateAsync(); // Applying again is safe.
            Assert.Equal(1, await db.ComplaintEvents.CountAsync());
        }
        finally { await db.Database.EnsureDeletedAsync(); }
    }

    [ComplaintBrowserFact]
    public async Task Browser_LiveMonitoringForwardingAuthorityResponseAndNotifications()
    {
        await using var test = await Harness.CreateAsync();
        var script = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../scripts/tests/complaint-accountability.cjs"));
        var processInfo = new ProcessStartInfo("node") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        processInfo.ArgumentList.Add(script);
        processInfo.Environment["WWMS_WEB_URL"] = test.Client.BaseAddress!.ToString();
        processInfo.Environment["WWMS_COMPLAINT_ID"] = test.ComplaintId.ToString();
        processInfo.Environment["WWMS_PASSENGER_ID"] = test.PassengerId.ToString();
        using var process = Process.Start(processInfo)!;
        var output = process.StandardOutput.ReadToEndAsync();
        var errors = process.StandardError.ReadToEndAsync();
        try { await process.WaitForExitAsync(new CancellationTokenSource(TimeSpan.FromMinutes(3)).Token); }
        catch (OperationCanceledException) { process.Kill(entireProcessTree: true); throw; }
        Assert.True(process.ExitCode == 0, $"Browser workflow failed: {await output}\n{await errors}");
        Assert.Equal(ComplaintStatus.Reopened, (await test.Current(test.ComplaintId)).Status);
        Assert.Equal(2, await test.Db.ComplaintAssignments.CountAsync());
        Assert.True(await test.Db.ComplaintEvents.AnyAsync(x => x.Text == "Browser follow-up response"));
    }

    private sealed class FailureInjector : SaveChangesInterceptor
    {
        public bool FailNextSave { get; set; }
        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
        {
            if (FailNextSave) { FailNextSave = false; throw new InvalidOperationException("Simulated notification persistence failure after SQL writes"); }
            return ValueTask.FromResult(result);
        }
    }

    private sealed class Harness(WebApplication app, WhaleWatchingDbContext db, HttpClient client, FailureInjector failure) : IAsyncDisposable
    {
        private const string SigningKey = "Isolated-test-only-signing-key-wwms-123456789";
        public WhaleWatchingDbContext Db => db;
        public HttpClient Client => client;
        public FailureInjector Failure => failure;
        public Dictionary<string, Guid> Users { get; } = [];
        public Dictionary<string, Guid> Roles { get; } = [];
        public Guid ComplaintId { get; private set; }
        public Guid PassengerId { get; private set; }
        public static string Connection() => new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("WWMS_TEST_SQL_CONNECTION"))
            { InitialCatalog = $"WWMS_ComplaintTests_{Guid.NewGuid():N}" }.ConnectionString;
        public static async Task<Harness> CreateAsync()
        {
            var connection = Connection();
            var db = new WhaleWatchingDbContext(new DbContextOptionsBuilder<WhaleWatchingDbContext>().UseSqlServer(connection).Options);
            await db.Database.EnsureCreatedAsync();
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseUrls("http://127.0.0.1:0");
            builder.Logging.ClearProviders();
            var failure = new FailureInjector();
            builder.Services.AddDbContext<WhaleWatchingDbContext>(o => o.UseSqlServer(connection, sql => sql.EnableRetryOnFailure()).AddInterceptors(failure));
            builder.Services.AddSignalR();
            builder.Services.AddSingleton(TimeProvider.System);
            builder.Services.AddIdentityCore<ApplicationUser>().AddRoles<IdentityRole<Guid>>().AddSignInManager()
                .AddEntityFrameworkStores<WhaleWatchingDbContext>().AddDefaultTokenProviders();
            builder.Services.AddSingleton(Microsoft.Extensions.Options.Options.Create(new JwtOptions
                { Issuer = "WWMS.Test", Audience = "WWMS.Test", SigningKey = SigningKey }));
            builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
            builder.Services.AddScoped<IAuthService, AuthService>();
            builder.Services.AddRateLimiter(o => o.AddFixedWindowLimiter("auth", limiter =>
                { limiter.PermitLimit = 100; limiter.Window = TimeSpan.FromMinutes(1); }));
            builder.Services.AddScoped<ComplaintAccess>(); builder.Services.AddScoped<ComplaintWorkflow>();
            builder.Services.AddControllers().AddApplicationPart(typeof(ComplaintWorkflowController).Assembly);
            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
            {
                o.MapInboundClaims = false;
                o.TokenValidationParameters = new TokenValidationParameters { ValidateIssuer = false, ValidateAudience = false,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey)), ValidateIssuerSigningKey = true, RoleClaimType = "role" };
                o.Events = new JwtBearerEvents { OnMessageReceived = context =>
                {
                    if (context.HttpContext.Request.Path.StartsWithSegments("/hubs/operations")) context.Token = context.Request.Query["access_token"];
                    return Task.CompletedTask;
                } };
            });
            builder.Services.AddAuthorizationBuilder()
                .AddPolicy(PortalPolicies.PassengerMonitoring, p => p.RequireRole(ComplaintAccess.MonitorRoles))
                .AddPolicy(PortalPolicies.ComplaintAccess, p => p.RequireRole(ComplaintAccess.AllRoles));
            builder.Services.AddAuthorization(options =>
            {
                foreach (var role in PortalRoles.All) options.AddPolicy($"Portal:{role}", policy => policy.RequireRole(role));
            });
            var app = builder.Build();
            app.UseExceptionHandler(handler => handler.Run(async context => { context.Response.StatusCode = 500; await context.Response.WriteAsJsonAsync(new { message = "Test operation failed" }); }));
            app.UseRateLimiter(); app.UseAuthentication(); app.UseAuthorization(); app.MapControllers();
            app.MapHub<WhaleWatching.Api.Realtime.OperationsHub>("/hubs/operations");
            var webRoot = Environment.GetEnvironmentVariable("WWMS_BROWSER_WEB_ROOT");
            if (!string.IsNullOrEmpty(webRoot))
            {
                app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(webRoot) });
                app.MapFallback(async context =>
                {
                    context.Response.ContentType = "text/html";
                    await context.Response.SendFileAsync(Path.Combine(webRoot, "index.html"));
                });
            }
            await app.StartAsync();
            var test = new Harness(app, db, new HttpClient { BaseAddress = new Uri(app.Urls.Single()) }, failure);
            foreach (var name in PortalRoles.All)
            {
                var role = new IdentityRole<Guid>(name) { Id = Guid.NewGuid(), NormalizedName = name.ToUpperInvariant() };
                var user = new ApplicationUser { Id = Guid.NewGuid(), DisplayName = $"Test {name}", UserName = $"test-{name}", NormalizedUserName = $"TEST-{name.ToUpperInvariant()}",
                    Email = $"{name.ToLowerInvariant()}@complaint-test.example", NormalizedEmail = $"{name.ToUpperInvariant()}@COMPLAINT-TEST.EXAMPLE",
                    SecurityStamp = Guid.NewGuid().ToString(), EmailConfirmed = true };
                user.PasswordHash = new PasswordHasher<ApplicationUser>().HashPassword(user, "BrowserTest#2026!Only");
                db.Roles.Add(role); db.Users.Add(user); db.UserRoles.Add(new IdentityUserRole<Guid> { UserId = user.Id, RoleId = role.Id });
                test.Users.Add(name, user.Id); test.Roles.Add(name, role.Id);
            }
            var (passenger, trip) = await SeedPassengerAndTrips(db);
            test.PassengerId = passenger.Id;
            var complaint = new PassengerComplaint { Id = Guid.NewGuid(), PassengerId = passenger.Id, TripId = trip.Id, Type = "Safety concern", Message = "Safety investigation", CreatedAtUtc = DateTimeOffset.UtcNow, UpdatedAtUtc = DateTimeOffset.UtcNow };
            db.PassengerComplaints.Add(complaint); test.ComplaintId = complaint.Id;
            db.PassengerSessions.Add(new PassengerSession { Id = Guid.NewGuid(), PassengerId = passenger.Id, TripId = trip.Id,
                TokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("test-passenger-session"))), CreatedAtUtc = DateTimeOffset.UtcNow, ExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(1) });
            await db.SaveChangesAsync(); db.ChangeTracker.Clear();
            return test;
        }
        public static async Task<(PassengerProfile, Trip)> SeedPassengerAndTrips(WhaleWatchingDbContext db)
        {
            var owner = new ApplicationUser { Id = Guid.NewGuid(), DisplayName = "Test operator" };
            var boat = new Boat { Id = Guid.NewGuid(), Owner = owner, Name = "Test boat", RegistrationNumber = Guid.NewGuid().ToString(), RegistrationDate = new DateOnly(2026, 1, 1) };
            var passenger = new PassengerProfile { Id = Guid.NewGuid(), Name = "Passenger One", IdentificationNumber = "MONITOR-ID-1", NormalizedIdentificationNumber = "MONITOR-ID-1", PhoneNumber = "0701234567", NormalizedPhoneNumber = "0701234567", PassengerType = "Local", CountryCode = "LK", CreatedAtUtc = DateTimeOffset.UtcNow };
            db.PassengerProfiles.AddRange(passenger,
                new PassengerProfile { Id = Guid.NewGuid(), Name = "Passenger Two", NormalizedIdentificationNumber = "MONITOR-ID-2", CreatedAtUtc = DateTimeOffset.UtcNow },
                new PassengerProfile { Id = Guid.NewGuid(), Name = "Passenger Three", NormalizedIdentificationNumber = "MONITOR-ID-3", CreatedAtUtc = DateTimeOffset.UtcNow });
            var trips = new[] { new Trip { Id = Guid.NewGuid(), Boat = boat, Status = TripStatus.Completed, ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(-5) },
                new Trip { Id = Guid.NewGuid(), Boat = boat, Status = TripStatus.Scheduled, ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(1) } };
            db.Trips.AddRange(trips);
            foreach (var trip in trips) db.TripPassengers.Add(new TripPassenger { Id = Guid.NewGuid(), Trip = trip, Passenger = passenger, PrimaryPassenger = passenger, RegisteredAtUtc = trip.ScheduledDepartureUtc.AddHours(-1) });
            await db.SaveChangesAsync(); return (passenger, trips[0]);
        }
        public Task<PassengerComplaint> Current(Guid id) => db.PassengerComplaints.AsNoTracking().SingleAsync(x => x.Id == id);
        public async Task<ComplaintCommand> Command(Guid id, string action, Guid[]? roles = null, string? note = null, Guid? assignment = null, string? status = null, string? text = null) =>
            new(Guid.NewGuid(), (await Current(id)).Version, action, roles, note, assignment, status, text);
        public async Task Action(string role, Guid id, string action, Guid[]? roles = null, string? note = null, Guid? assignment = null, string? status = null, string? text = null) =>
            await Ok(role, HttpMethod.Post, $"/api/complaint-workflow/{id}/actions", await Command(id, action, roles, note, assignment, status, text));
        public Task<HttpResponseMessage> Send(string? role, HttpMethod method, string path, object? body = null)
        {
            var request = new HttpRequestMessage(method, path);
            if (body is not null) request.Content = JsonContent.Create(body);
            if (role is not null)
            {
                var jwt = new JwtSecurityToken(claims: [new Claim("sub", Users[role].ToString()), new Claim("role", role)], expires: DateTime.UtcNow.AddMinutes(20),
                    signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey)), SecurityAlgorithms.HmacSha256));
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(jwt));
            }
            return client.SendAsync(request);
        }
        public async Task<HttpResponseMessage> Ok(string role, HttpMethod method, string path, object? body = null)
        {
            var response = await Send(role, method, path, body);
            Assert.True(response.IsSuccessStatusCode, $"{method} {path}: {response.StatusCode} {await response.Content.ReadAsStringAsync()}");
            return response;
        }
        public async Task<JsonElement> Json(string role, string path) => await (await Ok(role, HttpMethod.Get, path)).Content.ReadFromJsonAsync<JsonElement>();
        public async ValueTask DisposeAsync() { client.Dispose(); await app.DisposeAsync(); await db.Database.EnsureDeletedAsync(); await db.DisposeAsync(); }
    }
}

public sealed class ComplaintBrowserFactAttribute : FactAttribute
{
    public ComplaintBrowserFactAttribute()
    {
        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WWMS_TEST_SQL_CONNECTION")) ||
            string.IsNullOrEmpty(Environment.GetEnvironmentVariable("PLAYWRIGHT_MODULE")) ||
            string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WWMS_BROWSER_WEB_ROOT")))
            Skip = "Set WWMS_TEST_SQL_CONNECTION, PLAYWRIGHT_MODULE, and WWMS_BROWSER_WEB_ROOT to run the live browser workflow.";
    }
}

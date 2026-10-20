using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Complaints;

[ApiController]
[Route("api/passenger-monitoring/analytics")]
[Authorize(Policy = PortalPolicies.PassengerMonitoring)]
public sealed class PassengerAnalyticsController(WhaleWatchingDbContext db, ComplaintAccess access, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> Analytics([FromQuery] MonitoringAnalyticsQuery query, CancellationToken ct)
    {
        if (await access.ActorAsync(User, ct) is not { Monitor: true }) return Forbid();
        var now = clock.GetUtcNow();
        var to = query.To ?? DateOnly.FromDateTime(now.ToOffset(MonitoringDates.Offset).DateTime);
        var from = query.From ?? to.AddDays(-Math.Min(29, to.DayNumber));
        if (to.Year == 9999 || !MonitoringDates.TryBounds(from, to, out var start, out var end) || to.DayNumber - from.DayNumber > 365)
            return BadRequest(new { message = "Choose a valid inclusive date range of at most 366 days." });

        // Aggregate dates in SQL, then combine at most 366 daily rows into chart buckets.
        // Database timestamps follow the existing UTC convention; reporting days are Asia/Colombo.
        var passengers = await db.PassengerProfiles.AsNoTracking().Where(x => x.CreatedAtUtc >= start && x.CreatedAtUtc < end)
            .GroupBy(x => x.CreatedAtUtc.AddMinutes(330).Date).Select(x => new { Day = x.Key, Count = x.Count() }).ToListAsync(ct);
        var registrations = await db.TripPassengers.AsNoTracking().Where(x => x.RegisteredAtUtc >= start && x.RegisteredAtUtc < end)
            .GroupBy(x => x.RegisteredAtUtc.AddMinutes(330).Date).Select(x => new { Day = x.Key, Count = x.Count() }).ToListAsync(ct);
        var records = db.PassengerComplaints.AsNoTracking().Where(x => x.CreatedAtUtc >= start && x.CreatedAtUtc < end);
        var submissions = await records.GroupBy(x => x.CreatedAtUtc.AddMinutes(330).Date)
            .Select(x => new { Day = x.Key, Complaints = x.Count(c => c.Kind == "Complaint"), Inquiries = x.Count(c => c.Kind == "Inquiry"),
                Unclassified = x.Count(c => c.Kind != "Complaint" && c.Kind != "Inquiry") }).ToListAsync(ct);
        var statuses = await records.GroupBy(x => x.Status).Select(x => new { Status = x.Key, Count = x.Count() }).ToListAsync(ct);
        var tripStats = await db.Trips.AsNoTracking().Where(x => x.ScheduledDepartureUtc >= start && x.ScheduledDepartureUtc < end)
            .GroupBy(x => 1).Select(x => new { Trips = x.Count(), Completed = x.Count(t => t.Status == TripStatus.Completed) }).SingleOrDefaultAsync(ct);

        var trends = new List<MonitoringTrend>();
        for (var bucket = MonitoringDates.BucketStart(from, query.Interval); bucket <= to; bucket = MonitoringDates.NextBucket(bucket, query.Interval))
        {
            var next = MonitoringDates.NextBucket(bucket, query.Interval);
            bool InBucket(DateTime day) => DateOnly.FromDateTime(day) >= bucket && DateOnly.FromDateTime(day) < next;
            trends.Add(new MonitoringTrend(bucket < from ? from : bucket, next.AddDays(-1) > to ? to : next.AddDays(-1),
                passengers.Where(x => InBucket(x.Day)).Sum(x => x.Count), registrations.Where(x => InBucket(x.Day)).Sum(x => x.Count),
                submissions.Where(x => InBucket(x.Day)).Sum(x => x.Complaints), submissions.Where(x => InBucket(x.Day)).Sum(x => x.Inquiries),
                submissions.Where(x => InBucket(x.Day)).Sum(x => x.Unclassified)));
        }
        var resolved = statuses.Where(x => x.Status == ComplaintStatus.Resolved).Sum(x => x.Count);
        var closed = statuses.Where(x => x.Status == ComplaintStatus.Closed).Sum(x => x.Count);
        var total = statuses.Sum(x => x.Count);
        return Ok(new
        {
            From = from, To = to, query.Interval, AsOfUtc = now,
            Totals = new
            {
                TotalPassengers = await db.PassengerProfiles.CountAsync(ct),
                NewPassengers = passengers.Sum(x => x.Count), Registrations = registrations.Sum(x => x.Count),
                Trips = tripStats?.Trips ?? 0, CompletedTrips = tripStats?.Completed ?? 0,
                Complaints = submissions.Sum(x => x.Complaints), Inquiries = submissions.Sum(x => x.Inquiries),
                Unclassified = submissions.Sum(x => x.Unclassified), Cases = total, OpenCases = total - resolved - closed,
                Resolved = resolved, Closed = closed,
                AwaitingReview = statuses.Where(x => x.Status is ComplaintStatus.Submitted or ComplaintStatus.Reopened).Sum(x => x.Count),
                AwaitingAcknowledgment = await records.CountAsync(x => x.Assignments.Any(a => a.Status == ComplaintAssignmentStatus.Pending), ct),
                AwaitingResponses = await records.CountAsync(x => x.Assignments.Any(a => a.Status != ComplaintAssignmentStatus.Responded), ct)
            },
            Trends = trends,
            StatusDistribution = Enum.GetValues<ComplaintStatus>().Select(s => new MonitoringStatusCount(s.ToString(), statuses.Where(x => x.Status == s).Sum(x => x.Count))),
            RecentCases = await records.IgnoreQueryFilters().OrderByDescending(x => x.CreatedAtUtc).ThenBy(x => x.Id).Take(5)
                .Select(x => new ComplaintSummary(x.Id, "WWMS-" + x.Id.ToString(), x.Kind, x.PassengerId, x.Passenger.Name, x.TripId,
                    x.Trip.Boat.Name, x.Type, x.Status.ToString(), x.CreatedAtUtc, x.UpdatedAtUtc,
                    x.Assignments.Count(a => a.Status != ComplaintAssignmentStatus.Responded))).ToListAsync(ct)
        });
    }
}

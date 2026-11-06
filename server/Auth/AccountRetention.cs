using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Auth;

/// <summary>Existing account archival rules retain completed operations and audit references.</summary>
public static class AccountRetention
{
    public static async Task ReleaseOwnerMembershipsAsync(WhaleWatchingDbContext db, Guid userId, CancellationToken ct) =>
        db.OwnerCrewMemberships.RemoveRange(await db.OwnerCrewMemberships.Where(x => x.OwnerId == userId).ToListAsync(ct));

    public static async Task ReleaseCrewAssignmentsAsync(WhaleWatchingDbContext db, Guid userId, CancellationToken ct)
    {
        var assignments = await db.CrewAssignments.Where(x => x.CrewUserId == userId).ToListAsync(ct);
        foreach (var assignment in assignments) assignment.IsActive = false;
        db.OwnerCrewMemberships.RemoveRange(await db.OwnerCrewMemberships.Where(x => x.CrewUserId == userId).ToListAsync(ct));
        db.TripCrewAssignments.RemoveRange(await db.TripCrewAssignments.Where(x => x.CrewUserId == userId &&
            (x.Trip.Status == TripStatus.Scheduled || x.Trip.Status == TripStatus.Boarding || x.Trip.Status == TripStatus.NeedsReschedule)).ToListAsync(ct));
    }
}

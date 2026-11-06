using System.Data;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Auth;

public sealed class AccountDeletionService(WhaleWatchingDbContext db, TimeProvider clock)
{
    public async Task<string?> DeleteAsync(Guid userId, CancellationToken ct) =>
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, ct);
            if (user is null || user.AccountDeletedAtUtc is not null) return null;
            var now = clock.GetUtcNow();
            // Reuse the existing owner/crew deletion restrictions; never cascade shared data.
            if (await db.Boats.AnyAsync(x => x.OwnerId == userId, ct))
                return "Your account still owns active boats. Arrange their reassignment or removal before deleting your account.";
            if (await db.TripCrewAssignments.AnyAsync(x => x.CrewUserId == userId && x.Trip.Status == TripStatus.Ongoing, ct))
                return "Your account is assigned to an ongoing trip. End the trip or contact an administrator before deleting your account.";
            var adminRole = await db.Roles.Where(x => x.Name == PortalRoles.Admin).Select(x => x.Id).SingleOrDefaultAsync(ct);
            if (await db.UserRoles.AnyAsync(x => x.UserId == userId && x.RoleId == adminRole, ct) &&
                !await db.Users.AnyAsync(x => x.Id != userId && x.AccountDeletedAtUtc == null && x.PasswordHash != null &&
                    x.EmailConfirmed && (!x.LockoutEnabled || x.LockoutEnd == null || x.LockoutEnd <= now) &&
                    db.UserRoles.Any(role => role.UserId == x.Id && role.RoleId == adminRole), ct))
                return "The last active administrator cannot be deleted. Arrange another active administrator first.";

            await AccountRetention.ReleaseOwnerMembershipsAsync(db, userId, ct);
            await AccountRetention.ReleaseCrewAssignmentsAsync(db, userId, ct);
            db.UserRoles.RemoveRange(await db.UserRoles.Where(x => x.UserId == userId).ToListAsync(ct));
            db.UserClaims.RemoveRange(await db.UserClaims.Where(x => x.UserId == userId).ToListAsync(ct));
            db.UserLogins.RemoveRange(await db.UserLogins.Where(x => x.UserId == userId).ToListAsync(ct));
            db.UserTokens.RemoveRange(await db.UserTokens.Where(x => x.UserId == userId).ToListAsync(ct));
            foreach (var token in await db.RefreshTokens.Where(x => x.UserId == userId && x.RevokedAtUtc == null).ToListAsync(ct))
            {
                token.RevokedAtUtc = now; token.RevocationReason = "Account permanently deleted";
            }
            var recoveries = await db.PasswordRecoveries.Where(x => x.UserId == userId && x.ConsumedAt == null).ToListAsync(ct);
            foreach (var recovery in recoveries) recovery.CancelledAt = now;
            // Keep the identity row for restrictive historical foreign keys, as the existing
            // Admin archive flow does. Credentials/access are irreversibly removed, not restorable.
            user.AccountDeletedAtUtc = now;
            user.PasswordHash = null; user.SecurityStamp = Guid.NewGuid().ToString("N");
            user.ConcurrencyStamp = Guid.NewGuid().ToString("N");
            user.LockoutEnabled = true; user.LockoutEnd = DateTimeOffset.MaxValue;
            user.EmailConfirmed = false; user.PhoneNumberConfirmed = false; user.TwoFactorEnabled = false;
            user.IsCrewCertified = false;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return null;
        });
}

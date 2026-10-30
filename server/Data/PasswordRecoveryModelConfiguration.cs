using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Data;

public static class PasswordRecoveryModelConfiguration
{
    public static void Configure(ModelBuilder builder)
    {
        var recovery = builder.Entity<PasswordRecovery>();
        recovery.Property(x => x.AccountKey).HasMaxLength(64).IsUnicode(false);
        recovery.Property(x => x.AccountStateHash).HasMaxLength(64).IsUnicode(false);
        recovery.Property(x => x.CodeHash).HasMaxLength(64).IsUnicode(false);
        recovery.Property(x => x.AuthorizationHash).HasMaxLength(64).IsUnicode(false);
        recovery.HasIndex(x => new { x.AccountKey, x.CreatedAt });
        recovery.HasIndex(x => new { x.UserId, x.CreatedAt });
        recovery.HasIndex(x => x.CodeExpiresAt);
        recovery.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        var delivery = builder.Entity<PasswordRecoveryDelivery>();
        delivery.Property(x => x.AccountKey).HasMaxLength(64).IsUnicode(false);
        delivery.Property(x => x.ProtectedCode).HasMaxLength(2048);
        delivery.HasOne(x => x.Recovery).WithMany().HasForeignKey(x => x.RecoveryId).OnDelete(DeleteBehavior.Cascade);
        delivery.HasIndex(x => new { x.AccountKey, x.CreatedAt });
        delivery.HasIndex(x => new { x.CompletedAt, x.NextAttemptAt });
        var rate = builder.Entity<PasswordRecoveryRateWindow>();
        rate.Property(x => x.Id).HasMaxLength(64).IsUnicode(false);
        rate.HasIndex(x => x.ExpiresAt);
    }
}

using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Data;

public sealed class WhaleWatchingDbContext(DbContextOptions<WhaleWatchingDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<GpsTelemetry> GpsTelemetry => Set<GpsTelemetry>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var telemetry = modelBuilder.Entity<GpsTelemetry>();

        telemetry.ToTable("GpsTelemetry");
        telemetry.HasKey(item => item.Id);
        telemetry.Property(item => item.DeviceId)
            .HasMaxLength(128)
            .IsRequired();
        telemetry.Property(item => item.Latitude)
            .HasPrecision(9, 6);
        telemetry.Property(item => item.Longitude)
            .HasPrecision(9, 6);
        telemetry.Property(item => item.RecordedAtUtc)
            .HasPrecision(3);
        telemetry.Property(item => item.ReceivedAtUtc)
            .HasPrecision(3);

        telemetry.HasIndex(item => new { item.DeviceId, item.RecordedAtUtc })
            .IsDescending(false, true)
            .HasDatabaseName("IX_GpsTelemetry_DeviceId_RecordedAtUtc");
        telemetry.HasIndex(item => item.RecordedAtUtc)
            .HasDatabaseName("IX_GpsTelemetry_RecordedAtUtc");

        telemetry.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_GpsTelemetry_Latitude",
                "[Latitude] >= -90 AND [Latitude] <= 90");
            table.HasCheckConstraint(
                "CK_GpsTelemetry_Longitude",
                "[Longitude] >= -180 AND [Longitude] <= 180");
        });

        var refreshToken = modelBuilder.Entity<RefreshToken>();
        refreshToken.ToTable("RefreshTokens");
        refreshToken.HasKey(token => token.Id);
        refreshToken.Property(token => token.TokenHash)
            .HasMaxLength(64)
            .IsFixedLength()
            .IsRequired();
        refreshToken.Property(token => token.SecurityStamp)
            .HasMaxLength(64)
            .IsRequired();
        refreshToken.Property(token => token.CreatedByIp)
            .HasMaxLength(64)
            .IsRequired();
        refreshToken.Property(token => token.RevokedByIp)
            .HasMaxLength(64);
        refreshToken.Property(token => token.RevocationReason)
            .HasMaxLength(256);
        refreshToken.Property(token => token.RowVersion)
            .IsRowVersion();
        refreshToken.HasIndex(token => token.TokenHash)
            .IsUnique();
        refreshToken.HasIndex(token => new { token.UserId, token.FamilyId });
        refreshToken.HasOne(token => token.User)
            .WithMany(user => user.RefreshTokens)
            .HasForeignKey(token => token.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

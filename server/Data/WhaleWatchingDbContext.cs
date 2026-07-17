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
    public DbSet<Boat> Boats => Set<Boat>();
    public DbSet<BoatDocument> BoatDocuments => Set<BoatDocument>();
    public DbSet<CrewAssignment> CrewAssignments => Set<CrewAssignment>();
    public DbSet<Trip> Trips => Set<Trip>();
    public DbSet<SosEvent> SosEvents => Set<SosEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<ApplicationUser>().Property(x => x.DisplayName).HasMaxLength(160);
        var boat = modelBuilder.Entity<Boat>();
        boat.Property(x => x.Name).HasMaxLength(160).IsRequired();
        boat.Property(x => x.RegistrationNumber).HasMaxLength(64).IsRequired();
        boat.Property(x => x.HullNumber).HasMaxLength(64).IsRequired();
        boat.Property(x => x.LengthMeters).HasPrecision(8, 2);
        boat.Property(x => x.WidthMeters).HasPrecision(8, 2);
        boat.HasIndex(x => x.RegistrationNumber).IsUnique();
        boat.HasOne(x => x.Owner).WithMany(x => x.OwnedBoats).HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);

        var assignment = modelBuilder.Entity<CrewAssignment>();
        assignment.Property(x => x.Position).HasMaxLength(100).IsRequired();
        assignment.HasIndex(x => new { x.BoatId, x.CrewUserId }).IsUnique();
        assignment.HasOne(x => x.CrewUser).WithMany(x => x.CrewAssignments).HasForeignKey(x => x.CrewUserId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<BoatDocument>().Property(x => x.Name).HasMaxLength(160).IsRequired();
        modelBuilder.Entity<BoatDocument>().Property(x => x.FileUrl).HasMaxLength(1000).IsRequired();
        modelBuilder.Entity<Trip>().Property(x => x.Route).HasMaxLength(300).IsRequired();
        modelBuilder.Entity<Trip>().Property(x => x.ShoreNotes).HasMaxLength(1000);
        modelBuilder.Entity<SosEvent>().Property(x => x.Message).HasMaxLength(1000).IsRequired();

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

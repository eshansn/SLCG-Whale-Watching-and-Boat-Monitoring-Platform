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
    public DbSet<OwnerCrewMembership> OwnerCrewMemberships => Set<OwnerCrewMembership>();
    public DbSet<TripCrewAssignment> TripCrewAssignments => Set<TripCrewAssignment>();
    public DbSet<PassengerProfile> PassengerProfiles => Set<PassengerProfile>();
    public DbSet<TripPassenger> TripPassengers => Set<TripPassenger>();
    public DbSet<PassengerSession> PassengerSessions => Set<PassengerSession>();
    public DbSet<TripPassengerAttendance> TripPassengerAttendances => Set<TripPassengerAttendance>();
    public DbSet<PassengerAttendanceAudit> PassengerAttendanceAudits => Set<PassengerAttendanceAudit>();
    public DbSet<PassengerComplaint> PassengerComplaints => Set<PassengerComplaint>();
    public DbSet<ComplaintImage> ComplaintImages => Set<ComplaintImage>();
    public DbSet<Trip> Trips => Set<Trip>();
    public DbSet<SosEvent> SosEvents => Set<SosEvent>();
    public DbSet<TripTransfer> TripTransfers => Set<TripTransfer>();
    public DbSet<TripTransferItem> TripTransferItems => Set<TripTransferItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var user = modelBuilder.Entity<ApplicationUser>();
        user.Property(x => x.DisplayName).HasMaxLength(160);
        user.Property(x => x.NicNumber).HasMaxLength(20);
        user.Property(x => x.ProfilePhotoContentType).HasMaxLength(64);
        user.Property(x => x.Bio).HasMaxLength(1000);
        user.Property(x => x.CrewType).HasMaxLength(100);
        user.HasIndex(x => x.NicNumber).IsUnique().HasFilter("[NicNumber] IS NOT NULL");
        var boat = modelBuilder.Entity<Boat>();
        boat.Property(x => x.Name).HasMaxLength(160).IsRequired();
        boat.Property(x => x.RegistrationNumber).HasMaxLength(64).IsRequired();
        boat.Property(x => x.HullNumber).HasMaxLength(64).IsRequired();
        boat.Property(x => x.LengthMeters).HasPrecision(8, 2);
        boat.Property(x => x.WidthMeters).HasPrecision(8, 2);
        boat.Property(x => x.MaximumSpeedKnots).HasPrecision(6, 2);
        boat.Property(x => x.GpsDeviceId).HasMaxLength(128);
        boat.HasIndex(x => x.RegistrationNumber).IsUnique();
        boat.HasIndex(x => x.GpsDeviceId).IsUnique().HasFilter("[GpsDeviceId] IS NOT NULL");
        boat.HasOne(x => x.Owner).WithMany(x => x.OwnedBoats).HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);

        var assignment = modelBuilder.Entity<CrewAssignment>();
        assignment.Property(x => x.Position).HasMaxLength(100).IsRequired();
        assignment.HasIndex(x => new { x.BoatId, x.CrewUserId }).IsUnique();
        assignment.HasOne(x => x.CrewUser).WithMany(x => x.CrewAssignments).HasForeignKey(x => x.CrewUserId).OnDelete(DeleteBehavior.Restrict);

        var membership = modelBuilder.Entity<OwnerCrewMembership>();
        membership.HasIndex(x => new { x.OwnerId, x.CrewUserId }).IsUnique();
        membership.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        membership.HasOne(x => x.CrewUser).WithMany(x => x.CrewMemberships).HasForeignKey(x => x.CrewUserId).OnDelete(DeleteBehavior.Restrict);

        var tripCrew = modelBuilder.Entity<TripCrewAssignment>();
        tripCrew.HasIndex(x => new { x.TripId, x.CrewUserId }).IsUnique();
        tripCrew.HasOne(x => x.Trip).WithMany(x => x.CrewAssignments).HasForeignKey(x => x.TripId).OnDelete(DeleteBehavior.Cascade);
        tripCrew.HasOne(x => x.CrewUser).WithMany(x => x.TripAssignments).HasForeignKey(x => x.CrewUserId).OnDelete(DeleteBehavior.Restrict);

        var passenger = modelBuilder.Entity<PassengerProfile>();
        passenger.Property(x => x.Name).HasMaxLength(160).IsRequired();
        passenger.Property(x => x.IdentificationNumber).HasMaxLength(32).IsRequired();
        passenger.Property(x => x.NormalizedIdentificationNumber).HasMaxLength(32).IsRequired();
        passenger.Property(x => x.PhoneNumber).HasMaxLength(32).IsRequired();
        passenger.Property(x => x.NormalizedPhoneNumber).HasMaxLength(32).IsRequired();
        passenger.Property(x => x.PassengerType).HasMaxLength(16).IsRequired();
        passenger.Property(x => x.Gender).HasMaxLength(16).IsRequired();
        passenger.Property(x => x.AgeCategory).HasMaxLength(16).IsRequired();
        passenger.Property(x => x.PersonalQrToken).HasMaxLength(64);
        passenger.HasIndex(x => x.NormalizedIdentificationNumber).IsUnique();
        passenger.HasIndex(x => x.PersonalQrToken).IsUnique().HasFilter("[PersonalQrToken] IS NOT NULL");

        var tripPassenger = modelBuilder.Entity<TripPassenger>();
        tripPassenger.HasIndex(x => new { x.TripId, x.PassengerId }).IsUnique();
        tripPassenger.HasOne(x => x.Trip).WithMany(x => x.Passengers).HasForeignKey(x => x.TripId).OnDelete(DeleteBehavior.Cascade);
        tripPassenger.HasOne(x => x.Passenger).WithMany(x => x.Trips).HasForeignKey(x => x.PassengerId).OnDelete(DeleteBehavior.Restrict);
        tripPassenger.HasOne(x => x.PrimaryPassenger).WithMany().HasForeignKey(x => x.PrimaryPassengerId).OnDelete(DeleteBehavior.Restrict);

        var attendance = modelBuilder.Entity<TripPassengerAttendance>();
        attendance.HasIndex(x => x.TripPassengerId).IsUnique();
        attendance.HasOne(x => x.TripPassenger).WithOne(x => x.Attendance)
            .HasForeignKey<TripPassengerAttendance>(x => x.TripPassengerId).OnDelete(DeleteBehavior.Cascade);
        attendance.HasOne(x => x.CheckedByUser).WithMany().HasForeignKey(x => x.CheckedByUserId).OnDelete(DeleteBehavior.Restrict);

        var attendanceAudit = modelBuilder.Entity<PassengerAttendanceAudit>();
        attendanceAudit.HasIndex(x => x.ChangedAtUtc);
        attendanceAudit.HasOne(x => x.Attendance).WithMany(x => x.AuditEntries)
            .HasForeignKey(x => x.AttendanceId).OnDelete(DeleteBehavior.Cascade);
        attendanceAudit.HasOne(x => x.ChangedByUser).WithMany().HasForeignKey(x => x.ChangedByUserId).OnDelete(DeleteBehavior.Restrict);

        var passengerSession = modelBuilder.Entity<PassengerSession>();
        passengerSession.Property(x => x.TokenHash).HasMaxLength(64).IsFixedLength().IsRequired();
        passengerSession.HasIndex(x => x.TokenHash).IsUnique();
        passengerSession.HasOne(x => x.Passenger).WithMany(x => x.Sessions).HasForeignKey(x => x.PassengerId).OnDelete(DeleteBehavior.Cascade);
        passengerSession.HasOne(x => x.Trip).WithMany().HasForeignKey(x => x.TripId).OnDelete(DeleteBehavior.Restrict);

        var complaint = modelBuilder.Entity<PassengerComplaint>();
        complaint.Property(x => x.Type).HasMaxLength(64).IsRequired();
        complaint.Property(x => x.Message).HasMaxLength(2000).IsRequired();
        complaint.HasIndex(x => x.CreatedAtUtc);
        complaint.HasOne(x => x.Passenger).WithMany(x => x.Complaints).HasForeignKey(x => x.PassengerId).OnDelete(DeleteBehavior.Restrict);
        complaint.HasOne(x => x.Trip).WithMany().HasForeignKey(x => x.TripId).OnDelete(DeleteBehavior.Restrict);

        var complaintImage = modelBuilder.Entity<ComplaintImage>();
        complaintImage.Property(x => x.FileName).HasMaxLength(255).IsRequired();
        complaintImage.Property(x => x.ContentType).HasMaxLength(128).IsRequired();
        complaintImage.Property(x => x.Content).IsRequired();
        complaintImage.HasOne(x => x.Complaint).WithMany(x => x.Images).HasForeignKey(x => x.ComplaintId).OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<BoatDocument>().Property(x => x.Name).HasMaxLength(160).IsRequired();
        modelBuilder.Entity<BoatDocument>().Property(x => x.FileUrl).HasMaxLength(1000);
        modelBuilder.Entity<BoatDocument>().Property(x => x.FileName).HasMaxLength(255).IsRequired();
        modelBuilder.Entity<BoatDocument>().Property(x => x.ContentType).HasMaxLength(128).IsRequired();
        modelBuilder.Entity<Trip>().Property(x => x.Route).HasMaxLength(300).IsRequired();
        modelBuilder.Entity<Trip>().Property(x => x.ShoreNotes).HasMaxLength(1000);
        modelBuilder.Entity<Trip>().Property(x => x.InvitationCode).HasMaxLength(64);
        modelBuilder.Entity<Trip>().HasIndex(x => x.InvitationCode).IsUnique().HasFilter("[InvitationCode] IS NOT NULL");
        modelBuilder.Entity<Trip>().HasOne(x => x.PassengerVerificationFinalizedByUser).WithMany()
            .HasForeignKey(x => x.PassengerVerificationFinalizedByUserId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<SosEvent>().Property(x => x.Message).HasMaxLength(1000).IsRequired();

        var transfer = modelBuilder.Entity<TripTransfer>();
        transfer.Property(x => x.Reason).HasMaxLength(100).IsRequired();
        transfer.Property(x => x.Explanation).HasMaxLength(1000);
        transfer.Property(x => x.Status).HasMaxLength(32).IsRequired();
        transfer.HasIndex(x => new { x.InitiatedByUserId, x.ClientRequestId }).IsUnique();
        transfer.HasOne(x => x.SourceTrip).WithMany().HasForeignKey(x => x.SourceTripId).OnDelete(DeleteBehavior.Restrict);
        transfer.HasOne(x => x.DestinationTrip).WithMany().HasForeignKey(x => x.DestinationTripId).OnDelete(DeleteBehavior.Restrict);
        transfer.HasOne(x => x.InitiatedByUser).WithMany().HasForeignKey(x => x.InitiatedByUserId).OnDelete(DeleteBehavior.Restrict);

        var transferItem = modelBuilder.Entity<TripTransferItem>();
        transferItem.Property(x => x.PersonType).HasMaxLength(16).IsRequired();
        transferItem.Property(x => x.PersonName).HasMaxLength(160).IsRequired();
        transferItem.HasOne(x => x.Transfer).WithMany(x => x.Items).HasForeignKey(x => x.TransferId).OnDelete(DeleteBehavior.Cascade);

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
        telemetry.Property(item => item.SpeedKnots)
            .HasPrecision(6, 2);
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

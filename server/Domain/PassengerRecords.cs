namespace WhaleWatching.Api.Domain;

public sealed class PassengerProfile
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string IdentificationNumber { get; set; } = string.Empty;
    public string NormalizedIdentificationNumber { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string NormalizedPhoneNumber { get; set; } = string.Empty;
    public string PassengerType { get; set; } = string.Empty;
    public string Gender { get; set; } = string.Empty;
    public string AgeCategory { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public string? PersonalQrToken { get; set; }
    public ICollection<TripPassenger> Trips { get; set; } = [];
    public ICollection<PassengerSession> Sessions { get; set; } = [];
    public ICollection<PassengerComplaint> Complaints { get; set; } = [];
}

public sealed class PassengerComplaint
{
    public Guid Id { get; set; }
    public Guid PassengerId { get; set; }
    public PassengerProfile Passenger { get; set; } = null!;
    public Guid TripId { get; set; }
    public Trip Trip { get; set; } = null!;
    public string Type { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public ICollection<ComplaintImage> Images { get; set; } = [];
}

public sealed class ComplaintImage
{
    public Guid Id { get; set; }
    public Guid ComplaintId { get; set; }
    public PassengerComplaint Complaint { get; set; } = null!;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public byte[] Content { get; set; } = [];
}

public sealed class PassengerSession
{
    public Guid Id { get; set; }
    public Guid PassengerId { get; set; }
    public PassengerProfile Passenger { get; set; } = null!;
    public Guid TripId { get; set; }
    public Trip Trip { get; set; } = null!;
    public string TokenHash { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
}

public sealed class TripPassenger
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public Trip Trip { get; set; } = null!;
    public Guid PassengerId { get; set; }
    public PassengerProfile Passenger { get; set; } = null!;
    public Guid PrimaryPassengerId { get; set; }
    public PassengerProfile PrimaryPassenger { get; set; } = null!;
    public DateTimeOffset RegisteredAtUtc { get; set; }
    public TripPassengerAttendance? Attendance { get; set; }
}

public enum PassengerAttendanceStatus { NotChecked, Present, NotPresent }

public sealed class TripPassengerAttendance
{
    public Guid Id { get; set; }
    public Guid TripPassengerId { get; set; }
    public TripPassenger TripPassenger { get; set; } = null!;
    public PassengerAttendanceStatus Status { get; set; }
    public Guid? CheckedByUserId { get; set; }
    public ApplicationUser? CheckedByUser { get; set; }
    public DateTimeOffset? CheckedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public ICollection<PassengerAttendanceAudit> AuditEntries { get; set; } = [];
}

public sealed class PassengerAttendanceAudit
{
    public Guid Id { get; set; }
    public Guid AttendanceId { get; set; }
    public TripPassengerAttendance Attendance { get; set; } = null!;
    public PassengerAttendanceStatus PreviousStatus { get; set; }
    public PassengerAttendanceStatus NewStatus { get; set; }
    public Guid ChangedByUserId { get; set; }
    public ApplicationUser ChangedByUser { get; set; } = null!;
    public DateTimeOffset ChangedAtUtc { get; set; }
}

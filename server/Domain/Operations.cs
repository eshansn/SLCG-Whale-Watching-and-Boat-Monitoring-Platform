namespace WhaleWatching.Api.Domain;

public enum ApprovalStatus { Pending, Approved, Rejected }
public enum TripStatus { Scheduled, Boarding, Ongoing, Completed, Cancelled }

public sealed class Boat
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public ApplicationUser Owner { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string RegistrationNumber { get; set; } = string.Empty;
    public DateOnly RegistrationDate { get; set; }
    public string HullNumber { get; set; } = string.Empty;
    public decimal LengthMeters { get; set; }
    public decimal WidthMeters { get; set; }
    public decimal MaximumSpeedKnots { get; set; }
    public int MaximumCapacity { get; set; }
    public int LifeJacketCount { get; set; }
    public string? GpsDeviceId { get; set; }
    public ApprovalStatus Approval { get; set; }
    public ApprovalStatus WildlifeApproval { get; set; }
    public string? ImageUrl { get; set; }
    public ICollection<Trip> Trips { get; set; } = [];
    public ICollection<CrewAssignment> CrewAssignments { get; set; } = [];
    public ICollection<BoatDocument> Documents { get; set; } = [];
}

public sealed class BoatDocument
{
    public Guid Id { get; set; }
    public Guid BoatId { get; set; }
    public Boat Boat { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? FileUrl { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public byte[]? Content { get; set; }
    public DateTimeOffset UploadedAtUtc { get; set; }
}

public sealed class CrewAssignment
{
    public Guid Id { get; set; }
    public Guid BoatId { get; set; }
    public Boat Boat { get; set; } = null!;
    public Guid CrewUserId { get; set; }
    public ApplicationUser CrewUser { get; set; } = null!;
    public string Position { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public sealed class OwnerCrewMembership
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public ApplicationUser Owner { get; set; } = null!;
    public Guid CrewUserId { get; set; }
    public ApplicationUser CrewUser { get; set; } = null!;
    public DateTimeOffset AddedAtUtc { get; set; }
}

public sealed class Trip
{
    public Guid Id { get; set; }
    public Guid BoatId { get; set; }
    public Boat Boat { get; set; } = null!;
    public DateTimeOffset ScheduledDepartureUtc { get; set; }
    public DateTimeOffset? ActualDepartureUtc { get; set; }
    public DateTimeOffset? ActualArrivalUtc { get; set; }
    public string Route { get; set; } = string.Empty;
    public int PassengerCount { get; set; }
    public int ChildrenCount { get; set; }
    public int SpecialNeedsCount { get; set; }
    public TripStatus Status { get; set; }
    public ApprovalStatus ShoreApproval { get; set; }
    public string? ShoreNotes { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public string? InvitationCode { get; set; }
    public DateTimeOffset? PassengerVerificationFinalizedAtUtc { get; set; }
    public Guid? PassengerVerificationFinalizedByUserId { get; set; }
    public ApplicationUser? PassengerVerificationFinalizedByUser { get; set; }
    public ICollection<TripCrewAssignment> CrewAssignments { get; set; } = [];
    public ICollection<TripPassenger> Passengers { get; set; } = [];
}

public sealed class TripCrewAssignment
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public Trip Trip { get; set; } = null!;
    public Guid CrewUserId { get; set; }
    public ApplicationUser CrewUser { get; set; } = null!;
}

public sealed class SosEvent
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public Trip Trip { get; set; } = null!;
    public Guid RaisedByUserId { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTimeOffset RaisedAtUtc { get; set; }
    public DateTimeOffset? ResolvedAtUtc { get; set; }
}

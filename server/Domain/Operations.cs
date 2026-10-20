namespace WhaleWatching.Api.Domain;

public enum ApprovalStatus { Pending, Approved, Rejected }
public enum BoatDocumentStatus { PendingReview, Approved, Rejected, Expired, Superseded }
public enum TripStatus
{
    Scheduled = 0,
    Boarding = 1,
    Ongoing = 2,
    Completed = 3,
    Cancelled = 4,
    Declined = 5,
    NeedsReschedule = 6
}
public enum TripType { WhaleWatching, Patrol }

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
    public bool IsPatrolBoat { get; set; }
    public ApprovalStatus Approval { get; set; }
    public ApprovalStatus WildlifeApproval { get; set; }
    public bool IsDeleted { get; set; }
    // Compatibility reference updated by aerial-document uploads. API reads derive it from documents.
    public string? ImageUrl { get; set; }
    public int DocumentRequirementsVersion { get; set; } = 1;
    public DateTimeOffset? RegistrationSubmittedAtUtc { get; set; }
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
    public string DocumentType { get; set; } = string.Empty;
    public string? FileUrl { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public byte[]? Content { get; set; }
    public DateTimeOffset UploadedAtUtc { get; set; }
    public Guid? UploadedByUserId { get; set; }
    public ApplicationUser? UploadedByUser { get; set; }
    public DateOnly? ExpirationDate { get; set; }
    public DateTimeOffset? VerifiedAtUtc { get; set; }
    public Guid? VerifiedByUserId { get; set; }
    public ApplicationUser? VerifiedByUser { get; set; }
    public BoatDocumentStatus Status { get; set; } = BoatDocumentStatus.PendingReview;
    public int Version { get; set; } = 1;
    public bool IsCurrent { get; set; }
    public Guid? ReplacesDocumentId { get; set; }
    public BoatDocument? ReplacesDocument { get; set; }
    public string? RejectionReason { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
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
    public DateTimeOffset AssignedAtUtc { get; set; }
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
    public TripType Type { get; set; }
    public TripStatus Status { get; set; }
    public ApprovalStatus ShoreApproval { get; set; }
    public ApprovalStatus WildlifeShoreApproval { get; set; }
    public string? WildlifeShoreNotes { get; set; }
    public string? ShoreNotes { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public string? InvitationCode { get; set; }
    public DateTimeOffset? PassengerVerificationFinalizedAtUtc { get; set; }
    public Guid? PassengerVerificationFinalizedByUserId { get; set; }
    public ApplicationUser? PassengerVerificationFinalizedByUser { get; set; }
    public Guid? StartedByUserId { get; set; }
    public ApplicationUser? StartedByUser { get; set; }
    public string? StartedByRole { get; set; }
    public string? DeclineReason { get; set; }
    public Guid? DeclinedByUserId { get; set; }
    public ApplicationUser? DeclinedByUser { get; set; }
    public DateTimeOffset? DeclinedAtUtc { get; set; }
    public bool RescheduleOverride { get; set; }
    public Guid? RescheduleOverrideByUserId { get; set; }
    public ApplicationUser? RescheduleOverrideByUser { get; set; }
    public DateTimeOffset? RescheduleOverrideAtUtc { get; set; }
    public string? RescheduleOverrideReason { get; set; }
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
    public string Position { get; set; } = string.Empty;
    public string Source { get; set; } = "Legacy";
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
    public ICollection<SosAction> Actions { get; set; } = [];
}

public sealed class SosAction
{
    public Guid Id { get; set; }
    public Guid SosEventId { get; set; }
    public SosEvent SosEvent { get; set; } = null!;
    public Guid TakenByUserId { get; set; }
    public ApplicationUser TakenByUser { get; set; } = null!;
    public string ResponderName { get; set; } = string.Empty;
    public string ResponderIdNumber { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public DateTimeOffset TakenAtUtc { get; set; }
}

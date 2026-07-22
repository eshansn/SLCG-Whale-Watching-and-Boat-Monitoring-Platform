namespace WhaleWatching.Api.Domain;

public sealed class TripTransfer
{
    public Guid Id { get; set; }
    public Guid ClientRequestId { get; set; }
    public Guid SourceTripId { get; set; }
    public Trip SourceTrip { get; set; } = null!;
    public Guid DestinationTripId { get; set; }
    public Trip DestinationTrip { get; set; } = null!;
    public Guid InitiatedByUserId { get; set; }
    public ApplicationUser InitiatedByUser { get; set; } = null!;
    public string Reason { get; set; } = string.Empty;
    public string? Explanation { get; set; }
    public string Status { get; set; } = "Completed";
    public DateTimeOffset TransferredAtUtc { get; set; }
    public ICollection<TripTransferItem> Items { get; set; } = [];
}

public sealed class TripTransferItem
{
    public Guid Id { get; set; }
    public Guid TransferId { get; set; }
    public TripTransfer Transfer { get; set; } = null!;
    public Guid PersonId { get; set; }
    public string PersonType { get; set; } = string.Empty;
    public string PersonName { get; set; } = string.Empty;
}

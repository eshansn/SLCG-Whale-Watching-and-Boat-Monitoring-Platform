namespace WhaleWatching.Api.Domain;

public sealed class GpsTelemetry
{
    public long Id { get; set; }
    public required string DeviceId { get; set; }
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public DateTimeOffset RecordedAtUtc { get; set; }
    public DateTimeOffset ReceivedAtUtc { get; set; }
}

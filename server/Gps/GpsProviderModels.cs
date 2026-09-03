namespace WhaleWatching.Api.Gps;

public sealed record GpsProviderObject(string DeviceId, string Name, string? Plate,
    string? Group, string? Icon);

public sealed record GpsPosition(string DeviceId, decimal Latitude, decimal Longitude,
    decimal? SpeedKilometersPerHour, decimal? HeadingDegrees, decimal? AltitudeMeters,
    DateTimeOffset RecordedAtUtc, IReadOnlyDictionary<string, string> Parameters);

public sealed record GpsLocationBatch(int RecordsReturned, int InvalidRecords,
    IReadOnlyList<GpsPosition> Locations);

public sealed record GpsRoute(IReadOnlyList<GpsPosition> Points);

public sealed record GpsProviderEvent(string? DeviceId, DateTimeOffset? RecordedAtUtc,
    string Type, decimal? Latitude, decimal? Longitude, decimal? SpeedKilometersPerHour);

public interface IGpsProvider
{
    Task<IReadOnlyList<GpsProviderObject>> GetObjectsAsync(CancellationToken cancellationToken);
    Task<GpsLocationBatch> GetLatestLocationsAsync(CancellationToken cancellationToken);
    Task<GpsRoute> GetRouteAsync(string deviceId, DateTimeOffset fromUtc, DateTimeOffset toUtc,
        int minimumStopMinutes, CancellationToken cancellationToken);
    Task<GpsLocationBatch> GetMessagesAsync(string deviceId, DateTimeOffset fromUtc,
        DateTimeOffset toUtc, CancellationToken cancellationToken);
    Task<IReadOnlyList<GpsProviderEvent>> GetEventsAsync(string deviceId, DateTimeOffset fromUtc,
        DateTimeOffset toUtc, CancellationToken cancellationToken);
    Task<IReadOnlyList<GpsProviderEvent>> GetLastEventsAsync(bool sevenDays,
        CancellationToken cancellationToken);
}

public sealed class GpsProviderException(string category, Exception? innerException = null)
    : Exception($"GPS provider request failed ({category}).", innerException)
{
    public string Category { get; } = category;
}

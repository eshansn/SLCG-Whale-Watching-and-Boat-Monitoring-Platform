using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Gps;

public sealed class GpsTelemetryIngestor(WhaleWatchingDbContext db)
{
    private const decimal KilometersPerNauticalMile = 1.852m;
    private static readonly SemaphoreSlim IngestionGate = new(1, 1);

    public async Task<GpsIngestionResult> IngestAsync(IEnumerable<GpsPosition> positions,
        DateTimeOffset receivedAtUtc, CancellationToken cancellationToken)
    {
        await IngestionGate.WaitAsync(cancellationToken);
        try
        {
            return await IngestCoreAsync(positions, receivedAtUtc, cancellationToken);
        }
        finally
        {
            IngestionGate.Release();
        }
    }

    private async Task<GpsIngestionResult> IngestCoreAsync(IEnumerable<GpsPosition> positions,
        DateTimeOffset receivedAtUtc, CancellationToken cancellationToken)
    {
        var candidates = positions.Where(IsValid).OrderBy(item => item.RecordedAtUtc).ToList();
        if (candidates.Count == 0) return new GpsIngestionResult(0, 0, []);

        var deviceIds = candidates.Select(item => item.DeviceId).Distinct(StringComparer.Ordinal).ToArray();
        var boats = await db.Boats.AsNoTracking().Where(boat => boat.GpsDeviceId != null &&
                deviceIds.Contains(boat.GpsDeviceId))
            .Select(boat => new GpsBoatMatch(boat.Id, boat.GpsDeviceId!))
            .ToDictionaryAsync(item => item.DeviceId, StringComparer.Ordinal, cancellationToken);

        var mapped = candidates.Where(item => boats.ContainsKey(item.DeviceId)).ToList();
        var unknownCount = candidates.Count - mapped.Count;
        if (mapped.Count == 0) return new GpsIngestionResult(unknownCount, 0, []);

        var from = mapped.Min(item => item.RecordedAtUtc);
        var to = mapped.Max(item => item.RecordedAtUtc);
        var mappedDeviceIds = mapped.Select(item => item.DeviceId).Distinct().ToArray();
        var existingRows = await db.GpsTelemetry.AsNoTracking()
            .Where(item => mappedDeviceIds.Contains(item.DeviceId) &&
                item.RecordedAtUtc >= from && item.RecordedAtUtc <= to)
            .Select(item => new { item.DeviceId, item.RecordedAtUtc })
            .ToListAsync(cancellationToken);
        var existing = existingRows.Select(item => new GpsTelemetryKey(item.DeviceId, item.RecordedAtUtc))
            .ToHashSet();

        var plan = Plan(mapped, boats, existing, receivedAtUtc);
        var accepted = plan.Accepted;
        db.GpsTelemetry.AddRange(accepted.Select(item => item.Telemetry));

        if (accepted.Count > 0) await db.SaveChangesAsync(cancellationToken);
        return new GpsIngestionResult(unknownCount, plan.DuplicateCount, accepted);
    }

    internal static bool IsValid(GpsPosition position) =>
        !string.IsNullOrWhiteSpace(position.DeviceId) &&
        position.Latitude is >= -90 and <= 90 && position.Longitude is >= -180 and <= 180 &&
        position.RecordedAtUtc.Offset == TimeSpan.Zero;

    internal static GpsIngestionPlan Plan(IReadOnlyList<GpsPosition> positions,
        IReadOnlyDictionary<string, GpsBoatMatch> boats, ISet<GpsTelemetryKey> existing,
        DateTimeOffset receivedAtUtc)
    {
        var accepted = new List<GpsAcceptedPosition>();
        var unknown = 0;
        var duplicates = 0;
        foreach (var position in positions.Where(IsValid).OrderBy(item => item.RecordedAtUtc))
        {
            if (!boats.TryGetValue(position.DeviceId, out var boat))
            {
                unknown++;
                continue;
            }
            var key = new GpsTelemetryKey(position.DeviceId, position.RecordedAtUtc);
            if (!existing.Add(key))
            {
                duplicates++;
                continue;
            }
            accepted.Add(new GpsAcceptedPosition(boat.BoatId, new GpsTelemetry
            {
                DeviceId = position.DeviceId,
                Latitude = position.Latitude,
                Longitude = position.Longitude,
                SpeedKnots = position.SpeedKilometersPerHour is null ? null :
                    Math.Round(position.SpeedKilometersPerHour.Value / KilometersPerNauticalMile, 2),
                HeadingDegrees = position.HeadingDegrees,
                AltitudeMeters = position.AltitudeMeters,
                RecordedAtUtc = position.RecordedAtUtc,
                ReceivedAtUtc = receivedAtUtc
            }));
        }
        return new GpsIngestionPlan(unknown, duplicates, accepted);
    }
}

public sealed record GpsAcceptedPosition(Guid BoatId, GpsTelemetry Telemetry);
public sealed record GpsIngestionResult(int UnknownDeviceCount, int DuplicateCount,
    IReadOnlyList<GpsAcceptedPosition> Accepted);
internal sealed record GpsIngestionPlan(int UnknownDeviceCount, int DuplicateCount,
    List<GpsAcceptedPosition> Accepted);
internal sealed record GpsBoatMatch(Guid BoatId, string DeviceId);
internal sealed record GpsTelemetryKey(string DeviceId, DateTimeOffset RecordedAtUtc);

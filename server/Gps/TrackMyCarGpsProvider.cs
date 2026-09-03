using System.Globalization;
using System.Text.Json;

namespace WhaleWatching.Api.Gps;

public sealed class TrackMyCarGpsProvider(TrackMyCarApiClient client) : IGpsProvider
{
    private static readonly int[] AllowedStopMinutes = [1, 2, 5, 10, 20, 30, 60, 120, 300];

    public async Task<IReadOnlyList<GpsProviderObject>> GetObjectsAsync(CancellationToken cancellationToken)
    {
        using var document = await client.ExecuteAsync("USER_GET_OBJECTS", cancellationToken);
        return Records(document.RootElement).Select(element => new GpsProviderObject(
                Text(element, "imei") ?? string.Empty,
                Text(element, "name") ?? string.Empty,
                Text(element, "plate"), Text(element, "group"), Text(element, "icon")))
            .Where(item => !string.IsNullOrWhiteSpace(item.DeviceId)).ToList();
    }

    public async Task<GpsLocationBatch> GetLatestLocationsAsync(CancellationToken cancellationToken)
    {
        using var document = await client.ExecuteAsync("OBJECT_GET_LOCATIONS,*", cancellationToken);
        return ParsePositions(document.RootElement, null);
    }

    public async Task<GpsRoute> GetRouteAsync(string deviceId, DateTimeOffset fromUtc,
        DateTimeOffset toUtc, int minimumStopMinutes, CancellationToken cancellationToken)
    {
        ValidateRange(deviceId, fromUtc, toUtc);
        if (!AllowedStopMinutes.Contains(minimumStopMinutes))
            throw new ArgumentOutOfRangeException(nameof(minimumStopMinutes));
        using var document = await client.ExecuteAsync(
            $"OBJECT_GET_ROUTE,{deviceId},{Utc(fromUtc)},{Utc(toUtc)},{minimumStopMinutes}", cancellationToken);
        return new GpsRoute(ParsePositions(document.RootElement, deviceId).Locations);
    }

    public async Task<GpsLocationBatch> GetMessagesAsync(string deviceId, DateTimeOffset fromUtc,
        DateTimeOffset toUtc, CancellationToken cancellationToken)
    {
        ValidateRange(deviceId, fromUtc, toUtc);
        using var document = await client.ExecuteAsync(
            $"OBJECT_GET_MESSAGES,{deviceId},{Utc(fromUtc)},{Utc(toUtc)}", cancellationToken);
        return ParsePositions(document.RootElement, deviceId);
    }

    public async Task<IReadOnlyList<GpsProviderEvent>> GetEventsAsync(string deviceId,
        DateTimeOffset fromUtc, DateTimeOffset toUtc, CancellationToken cancellationToken)
    {
        ValidateRange(deviceId, fromUtc, toUtc);
        using var document = await client.ExecuteAsync(
            $"OBJECT_GET_EVENTS,{deviceId},{Utc(fromUtc)},{Utc(toUtc)}", cancellationToken);
        return ParseEvents(document.RootElement, deviceId);
    }

    public async Task<IReadOnlyList<GpsProviderEvent>> GetLastEventsAsync(bool sevenDays,
        CancellationToken cancellationToken)
    {
        var command = sevenDays ? "OBJECT_GET_LAST_EVENTS_7D" : "OBJECT_GET_LAST_EVENTS";
        using var document = await client.ExecuteAsync(command, cancellationToken);
        return ParseEvents(document.RootElement, null);
    }

    internal static GpsLocationBatch ParsePositions(JsonElement root, string? fallbackDeviceId)
    {
        var records = LocationRecords(root, fallbackDeviceId).ToList();
        var positions = new List<GpsPosition>(records.Count);
        var invalid = 0;
        foreach (var record in records)
        {
            var element = record.Element;
            var deviceId = Text(element, "imei") ?? record.DeviceId;
            var latitude = Number(element, "lat");
            var longitude = Number(element, "lng");
            var timestamp = Text(element, "dt") ?? Text(element, "dt_tracker") ?? Text(element, "dt_server");
            var locationValid = Text(element, "loc_valid");
            if (string.IsNullOrWhiteSpace(deviceId) || latitude is null or < -90 or > 90 ||
                longitude is null or < -180 or > 180 || locationValid == "0" ||
                !TryParseUtc(timestamp, out var recordedAtUtc))
            {
                invalid++;
                continue;
            }

            var speed = Number(element, "speed");
            if (speed < 0) speed = null;
            var heading = Number(element, "angle");
            if (heading is < 0 or >= 360) heading = null;
            positions.Add(new GpsPosition(deviceId.Trim(), latitude.Value, longitude.Value,
                speed, heading, Number(element, "altitude"), recordedAtUtc,
                ParseParameters(element)));
        }
        return new GpsLocationBatch(records.Count, invalid, positions);
    }

    internal static bool TryParseUtc(string? value, out DateTimeOffset timestamp) =>
        DateTimeOffset.TryParseExact(value, "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out timestamp);

    private static IReadOnlyList<GpsProviderEvent> ParseEvents(JsonElement root, string? fallbackDeviceId) =>
        Records(root).Select(element =>
        {
            TryParseUtc(Text(element, "dt"), out var timestamp);
            return new GpsProviderEvent(Text(element, "imei") ?? fallbackDeviceId,
                timestamp == default ? null : timestamp,
                Text(element, "event") ?? Text(element, "type") ?? Text(element, "name") ?? "unknown",
                Number(element, "lat"), Number(element, "lng"), Number(element, "speed"));
        }).ToList();

    private static IEnumerable<JsonElement> Records(JsonElement root)
    {
        if (root.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in root.EnumerateArray())
                if (item.ValueKind == JsonValueKind.Object) yield return item;
            yield break;
        }
        if (root.ValueKind != JsonValueKind.Object) yield break;
        foreach (var name in new[] { "data", "messages", "locations", "route", "points", "events" })
        {
            if (!root.TryGetProperty(name, out var value)) continue;
            foreach (var item in Records(value)) yield return item;
            yield break;
        }
        if (root.TryGetProperty("dt", out _)) yield return root;
    }

    private static IEnumerable<LocationRecord> LocationRecords(JsonElement root, string? fallbackDeviceId)
    {
        if (root.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in root.EnumerateArray())
                foreach (var record in LocationRecords(item, fallbackDeviceId)) yield return record;
            yield break;
        }
        if (root.ValueKind != JsonValueKind.Object) yield break;

        if (root.TryGetProperty("lat", out _) && root.TryGetProperty("lng", out _))
        {
            yield return new LocationRecord(root, fallbackDeviceId);
            yield break;
        }

        foreach (var property in root.EnumerateObject())
        {
            if (property.Value.ValueKind is not (JsonValueKind.Object or JsonValueKind.Array)) continue;
            var deviceId = property.Name.All(char.IsDigit) ? property.Name : fallbackDeviceId;
            foreach (var record in LocationRecords(property.Value, deviceId)) yield return record;
        }
    }

    private static string? Text(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value)) return null;
        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null
        };
    }

    private static decimal? Number(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value)) return null;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number)) return number;
        return value.ValueKind == JsonValueKind.String && decimal.TryParse(value.GetString(),
            NumberStyles.Float, CultureInfo.InvariantCulture, out number) ? number : null;
    }

    private static IReadOnlyDictionary<string, string> ParseParameters(JsonElement element)
    {
        if (!element.TryGetProperty("params", out var parameterValue))
            return new Dictionary<string, string>();
        if (parameterValue.ValueKind == JsonValueKind.Object)
            return parameterValue.EnumerateObject().ToDictionary(property => property.Name,
                property => property.Value.ValueKind == JsonValueKind.String
                    ? property.Value.GetString() ?? string.Empty
                    : property.Value.GetRawText(), StringComparer.OrdinalIgnoreCase);

        var value = parameterValue.ValueKind == JsonValueKind.String ? parameterValue.GetString() : null;
        if (string.IsNullOrWhiteSpace(value)) return new Dictionary<string, string>();
        return value.Split('|', StringSplitOptions.RemoveEmptyEntries)
            .Select(item => item.Split('=', 2))
            .Where(parts => parts.Length == 2 && parts[0].Length > 0)
            .GroupBy(parts => parts[0], StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.Last()[1], StringComparer.OrdinalIgnoreCase);
    }

    private static void ValidateRange(string deviceId, DateTimeOffset fromUtc, DateTimeOffset toUtc)
    {
        if (string.IsNullOrWhiteSpace(deviceId) || deviceId.Any(character => !char.IsDigit(character)))
            throw new ArgumentException("A numeric IMEI is required.", nameof(deviceId));
        if (toUtc <= fromUtc) throw new ArgumentException("The end timestamp must be after the start timestamp.");
    }

    private static string Utc(DateTimeOffset value) =>
        value.UtcDateTime.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);

    private sealed record LocationRecord(JsonElement Element, string? DeviceId);
}

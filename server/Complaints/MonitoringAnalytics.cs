using System.ComponentModel.DataAnnotations;

namespace WhaleWatching.Api.Complaints;

public sealed class MonitoringAnalyticsQuery
{
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    [RegularExpression("^(daily|weekly|monthly)$")] public string Interval { get; set; } = "daily";
}

public sealed class MonitoringRecordsQuery : PageQuery
{
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    [MaxLength(24)] public string? Status { get; set; }
}

public static class MonitoringDates
{
    public static readonly TimeSpan Offset = TimeSpan.FromMinutes(330);

    public static bool TryBounds(DateOnly? from, DateOnly? to, out DateTimeOffset? start, out DateTimeOffset? end)
    {
        start = null; end = null;
        if (from > to || from is { DayNumber: 0 } || to == DateOnly.MaxValue) return false;
        if (from is { } first) start = new DateTimeOffset(first.ToDateTime(TimeOnly.MinValue), Offset).ToUniversalTime();
        if (to is { } last) end = new DateTimeOffset(last.AddDays(1).ToDateTime(TimeOnly.MinValue), Offset).ToUniversalTime();
        return true;
    }

    public static DateOnly BucketStart(DateOnly day, string interval) => interval switch
    {
        "weekly" => day.AddDays(-(((int)day.DayOfWeek + 6) % 7)),
        "monthly" => new DateOnly(day.Year, day.Month, 1),
        _ => day
    };

    public static DateOnly NextBucket(DateOnly day, string interval) => interval switch
    {
        "weekly" => day.AddDays(7), "monthly" => day.AddMonths(1), _ => day.AddDays(1)
    };
}

public sealed record MonitoringTrend(DateOnly Start, DateOnly End, int Passengers, int Registrations, int Complaints, int Inquiries, int Unclassified);
public sealed record MonitoringStatusCount(string Status, int Count);
public sealed record MonitoringTripSummary(Guid Id, string BoatName, string RegistrationNumber, string OwnerName,
    string Route, DateTimeOffset ScheduledDepartureUtc, DateTimeOffset? ActualDepartureUtc, DateTimeOffset? ActualArrivalUtc,
    string Status, string Type, int RegisteredPassengers);

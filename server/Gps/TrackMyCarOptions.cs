using System.ComponentModel.DataAnnotations;

namespace WhaleWatching.Api.Gps;

public sealed class TrackMyCarOptions
{
    public const string SectionName = "TrackMyCar";

    [Required, Url]
    public string BaseUrl { get; set; } = "https://gps.trackmycar.lk/api/api.php";

    // Supplied only through TrackMyCar__ApiKey or .NET user secrets.
    public string ApiKey { get; set; } = string.Empty;

    [Range(1, 3600)]
    public int PollIntervalSeconds { get; set; } = 10;

    public bool Enabled { get; set; } = true;

    [Range(1, 300)]
    public int RequestTimeoutSeconds { get; set; } = 15;

    [Range(1, 86400)]
    public int StaleAfterSeconds { get; set; } = 60;

    [Range(1, 604800)]
    public int OfflineAfterSeconds { get; set; } = 300;

    [Range(1, 300)]
    public int RouteMinimumStopMinutes { get; set; } = 10;

    [Range(typeof(decimal), "0.01", "100")]
    public decimal StopSpeedThresholdKnots { get; set; } = 0.5m;
}

using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using WhaleWatching.Api.Gps;

namespace WhaleWatching.Api.Tests;

public sealed class TrackMyCarGpsProviderTests
{
    [Fact]
    public void Location_mapping_parses_utc_coordinates_speed_heading_altitude_and_params()
    {
        using var document = JsonDocument.Parse("""
            [{"imei":"351535133742000","dt":"2024-06-16 08:45:22","lat":6.902390,
              "lng":79.861240,"speed":48,"angle":180,"altitude":12,
              "params":"acc=1|fuel=65.4|batp=87"}]
            """);

        var batch = TrackMyCarGpsProvider.ParsePositions(document.RootElement, null);

        var location = Assert.Single(batch.Locations);
        Assert.Equal("351535133742000", location.DeviceId);
        Assert.Equal(new DateTimeOffset(2024, 6, 16, 8, 45, 22, TimeSpan.Zero), location.RecordedAtUtc);
        Assert.Equal(6.902390m, location.Latitude);
        Assert.Equal(79.861240m, location.Longitude);
        Assert.Equal(48m, location.SpeedKilometersPerHour);
        Assert.Equal(180m, location.HeadingDegrees);
        Assert.Equal(12m, location.AltitudeMeters);
        Assert.Equal("1", location.Parameters["acc"]);
        Assert.Equal(0, batch.InvalidRecords);
    }

    [Fact]
    public void Invalid_coordinates_and_non_utc_format_are_ignored()
    {
        using var document = JsonDocument.Parse("""
            [{"imei":"1","dt":"2024-06-16 08:45:22","lat":91,"lng":79},
             {"imei":"2","dt":"2024/06/16 08:45:22","lat":6,"lng":79}]
            """);

        var batch = TrackMyCarGpsProvider.ParsePositions(document.RootElement, null);

        Assert.Empty(batch.Locations);
        Assert.Equal(2, batch.InvalidRecords);
    }

    [Fact]
    public void Location_mapping_supports_imei_keyed_tracker_responses()
    {
        using var document = JsonDocument.Parse("""
            {"861327088731497":{"name":"CG 201","dt_server":"2026-09-02 07:17:39",
              "dt_tracker":"2026-09-02 07:17:37","lat":"5.94766","lng":"80.450487",
              "altitude":"5","angle":"184","speed":"0","loc_valid":"1",
              "params":{"gpslev":"14","gsmlev":"4"}}}
            """);

        var batch = TrackMyCarGpsProvider.ParsePositions(document.RootElement, null);

        var location = Assert.Single(batch.Locations);
        Assert.Equal("861327088731497", location.DeviceId);
        Assert.Equal(new DateTimeOffset(2026, 9, 2, 7, 17, 37, TimeSpan.Zero), location.RecordedAtUtc);
        Assert.Equal(5.94766m, location.Latitude);
        Assert.Equal(80.450487m, location.Longitude);
        Assert.Equal("14", location.Parameters["gpslev"]);
    }

    [Fact]
    public async Task Api_failure_does_not_expose_the_api_key()
    {
        const string secret = "unit-test-secret-that-must-not-appear";
        using var httpClient = new HttpClient(new StubHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.Forbidden)));
        var client = new TrackMyCarApiClient(httpClient, Options.Create(new TrackMyCarOptions
        {
            ApiKey = secret
        }));

        var exception = await Assert.ThrowsAsync<GpsProviderException>(() =>
            client.ExecuteAsync("USER_GET_OBJECTS", CancellationToken.None));

        Assert.Equal("authentication", exception.Category);
        Assert.DoesNotContain(secret, exception.ToString(), StringComparison.Ordinal);
    }

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> response)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,
            CancellationToken cancellationToken) => Task.FromResult(response(request));
    }
}

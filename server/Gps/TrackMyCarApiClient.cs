using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace WhaleWatching.Api.Gps;

public sealed class TrackMyCarApiClient(HttpClient httpClient, IOptions<TrackMyCarOptions> options)
{
    private readonly TrackMyCarOptions _options = options.Value;

    public async Task<JsonDocument> ExecuteAsync(string command, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
            throw new GpsProviderException("not-configured");

        Uri requestUri;
        try
        {
            requestUri = BuildRequestUri(command);
        }
        catch (Exception exception) when (exception is UriFormatException or ArgumentException)
        {
            throw new GpsProviderException("configuration");
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
            using var response = await httpClient.SendAsync(request,
                HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
                throw new GpsProviderException(CategoryFor(response.StatusCode));

            await using var body = await response.Content.ReadAsStreamAsync(cancellationToken);
            var document = await JsonDocument.ParseAsync(body, cancellationToken: cancellationToken);
            ThrowForProviderError(document.RootElement);
            return document;
        }
        catch (GpsProviderException)
        {
            throw;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new GpsProviderException("timeout");
        }
        catch (HttpRequestException)
        {
            throw new GpsProviderException("unavailable");
        }
        catch (JsonException)
        {
            throw new GpsProviderException("malformed-response");
        }
    }

    private Uri BuildRequestUri(string command)
    {
        var baseUri = new Uri(_options.BaseUrl, UriKind.Absolute);
        if (!string.Equals(baseUri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("TrackMyCar BaseUrl must use HTTPS.");

        var separator = string.IsNullOrEmpty(baseUri.Query) ? "?" : "&";
        return new Uri($"{baseUri}{separator}api=user&key={Uri.EscapeDataString(_options.ApiKey)}&cmd={Uri.EscapeDataString(command)}");
    }

    private static string CategoryFor(HttpStatusCode statusCode) => statusCode switch
    {
        HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => "authentication",
        HttpStatusCode.TooManyRequests => "rate-limit",
        HttpStatusCode.RequestTimeout or HttpStatusCode.GatewayTimeout => "timeout",
        _ => "http-error"
    };

    private static void ThrowForProviderError(JsonElement root)
    {
        if (root.ValueKind == JsonValueKind.String)
            throw new GpsProviderException("provider-error");
        if (root.ValueKind != JsonValueKind.Object) return;

        if (root.TryGetProperty("error", out var error) && error.ValueKind is not JsonValueKind.Null and not JsonValueKind.False)
            throw new GpsProviderException("provider-error");
        if (root.TryGetProperty("success", out var success) && success.ValueKind == JsonValueKind.False)
            throw new GpsProviderException("provider-error");
    }
}

using System.Net;
using Microsoft.Extensions.Options;
using WhaleWatching.Api.Gps;

namespace WhaleWatching.Api.Tests;

public sealed class GpsAuditTests
{
    [Fact]
    public async Task Audit_TrackMyCarDeadlineIncludesAStalledResponseBody()
    {
        using var caller = new CancellationTokenSource();
        using var http = new HttpClient(new BodyHandler());
        var client = new TrackMyCarApiClient(http, Options.Create(new TrackMyCarOptions {
            ApiKey = "test-only-never-log", RequestTimeoutSeconds = 1 }));
        var pending = client.ExecuteAsync("USER_GET_OBJECTS", caller.Token);
        try
        {
            Assert.Same(pending, await Task.WhenAny(pending, Task.Delay(TimeSpan.FromSeconds(3))));
            var error = await Assert.ThrowsAsync<GpsProviderException>(() => pending);
            Assert.Equal("timeout", error.Category);
            Assert.DoesNotContain("test-only-never-log", error.ToString());
        }
        finally { caller.Cancel(); try { await pending; } catch { /* Observe the cancelled reproduction too. */ } }
    }

    [Fact]
    public async Task Audit_TrackMyCarCallerCancellationRemainsCancellation()
    {
        using var caller = new CancellationTokenSource();
        using var http = new HttpClient(new BodyHandler());
        var client = new TrackMyCarApiClient(http, Options.Create(new TrackMyCarOptions { ApiKey = "test-only" }));
        var pending = client.ExecuteAsync("USER_GET_OBJECTS", caller.Token);
        caller.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
    }

    private sealed class BodyHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(new StalledStream()) });
    }

    private sealed class StalledStream : Stream
    {
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        { await Task.Delay(Timeout.Infinite, cancellationToken); return 0; }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override void Flush() => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}

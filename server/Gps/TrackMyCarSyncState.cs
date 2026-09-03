namespace WhaleWatching.Api.Gps;

public sealed class TrackMyCarSyncState
{
    private readonly object _gate = new();
    private DateTimeOffset? _lastSuccessfulSyncUtc;
    private string? _lastErrorCategory;

    public void Succeeded(DateTimeOffset atUtc)
    {
        lock (_gate)
        {
            _lastSuccessfulSyncUtc = atUtc;
            _lastErrorCategory = null;
        }
    }

    public void Failed(string category)
    {
        lock (_gate) _lastErrorCategory = category;
    }

    public (DateTimeOffset? LastSuccessfulSyncUtc, string? LastErrorCategory) Snapshot()
    {
        lock (_gate) return (_lastSuccessfulSyncUtc, _lastErrorCategory);
    }
}

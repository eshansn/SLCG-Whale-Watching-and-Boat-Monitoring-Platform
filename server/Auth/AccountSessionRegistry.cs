using System.Collections.Concurrent;

namespace WhaleWatching.Api.Auth;

/// <summary>Closes already authenticated realtime connections when an account is deleted.</summary>
public sealed class AccountSessionRegistry
{
    private readonly ConcurrentDictionary<(Guid User, string Connection), Action> connections = new();
    public void Register(Guid user, string connection, Action abort) => connections[(user, connection)] = abort;
    public void Remove(Guid user, string connection) => connections.TryRemove((user, connection), out _);
    public void Revoke(Guid user)
    {
        foreach (var entry in connections.Where(x => x.Key.User == user))
            if (connections.TryRemove(entry.Key, out var abort)) abort();
    }
}

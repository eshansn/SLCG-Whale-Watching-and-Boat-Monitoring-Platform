using WhaleWatching.Api.Auth;

namespace WhaleWatching.Api.Complaints;

public static class ComplaintAuthorities
{
    // Public recipient identifier; the receiving roles remain an internal routing detail.
    public static readonly Guid SlcgId = new("942104a6-2e9d-42dc-9d91-dc810b64eb87");
    public static readonly string[] SlcgRoles = [PortalRoles.Admin, PortalRoles.Ops];

    public static string? DisplayName(string? roleName) =>
        SlcgRoles.Contains(roleName) ? "SLCG" : roleName;
}

public sealed record ComplaintAuthority(Guid Id, string Name, int ActiveUsers, Guid[] RoleIds);

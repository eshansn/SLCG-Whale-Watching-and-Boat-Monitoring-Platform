using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Operations;

namespace WhaleWatching.Api.Tests;

public sealed class TripLifecycleAuthorizationTests
{
    [Fact]
    public void StartTrip_IsRestrictedToShoreCrewAndAdmin()
    {
        var method = typeof(OperationsController).GetMethod(nameof(OperationsController.StartTrip))!;
        var roles = method.GetCustomAttribute<AuthorizeAttribute>()!.Roles!.Split(',');

        Assert.Contains(PortalRoles.ShoreCrew, roles);
        Assert.Contains(PortalRoles.Admin, roles);
        Assert.DoesNotContain(PortalRoles.BoatOwner, roles);
        Assert.DoesNotContain(PortalRoles.BoatCrew, roles);
        Assert.DoesNotContain(PortalRoles.Wildlife, roles);
        Assert.DoesNotContain(PortalRoles.ShoreWildlife, roles);
    }

    [Fact]
    public void DeclineTrip_IsRestrictedToShoreCrewAndAdmin()
    {
        var method = typeof(OperationsController).GetMethod(nameof(OperationsController.DeclineTrip))!;
        var roles = method.GetCustomAttribute<AuthorizeAttribute>()!.Roles!.Split(',');

        Assert.Equal([PortalRoles.ShoreCrew, PortalRoles.Admin], roles);
    }

    [Fact]
    public void StartAndDecline_UseDedicatedPostRoutes()
    {
        var start = typeof(OperationsController).GetMethod(nameof(OperationsController.StartTrip))!;
        var decline = typeof(OperationsController).GetMethod(nameof(OperationsController.DeclineTrip))!;

        Assert.Equal("trips/{id:guid}/start", start.GetCustomAttribute<HttpPostAttribute>()!.Template);
        Assert.Equal("trips/{id:guid}/decline", decline.GetCustomAttribute<HttpPostAttribute>()!.Template);
    }

    [Fact]
    public void TripRoute_IsAvailableToEveryAuthenticatedTripPortal()
    {
        var method = typeof(OperationsController).GetMethod(nameof(OperationsController.TripTrackingSummary))!;
        var roles = method.GetCustomAttribute<AuthorizeAttribute>()!.Roles!.Split(',');

        Assert.Equal(
            [PortalRoles.Admin, PortalRoles.Wildlife, PortalRoles.Ops, PortalRoles.ShoreCrew,
                PortalRoles.BoatOwner, PortalRoles.BoatCrew],
            roles);
    }
}

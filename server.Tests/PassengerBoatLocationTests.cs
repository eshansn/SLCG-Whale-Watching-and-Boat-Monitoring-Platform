using System.Reflection;
using Microsoft.AspNetCore.Mvc;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Passenger;

namespace WhaleWatching.Api.Tests;

public sealed class PassengerBoatLocationTests
{
    [Fact]
    public void Endpoint_IsSessionScopedAndAcceptsNoBoatIdentifier()
    {
        var method = typeof(PassengerTripController).GetMethod(nameof(PassengerTripController.BoatLocation))!;

        Assert.Equal("~/api/passenger/session/boat-location",
            method.GetCustomAttribute<HttpGetAttribute>()!.Template);
        Assert.DoesNotContain(method.GetParameters(), parameter =>
            parameter.ParameterType == typeof(Guid) || parameter.Name?.Contains("boat", StringComparison.OrdinalIgnoreCase) == true);
    }

    [Theory]
    [InlineData(TripStatus.Scheduled, true, true, "Latest boat location")]
    [InlineData(TripStatus.Ongoing, true, true, "Live boat location")]
    [InlineData(TripStatus.Completed, true, false, "Trip completed")]
    [InlineData(TripStatus.NeedsReschedule, true, true, "needs rescheduling")]
    [InlineData(TripStatus.Declined, false, false, "Trip declined")]
    public void Presentation_IsStateAware(TripStatus status, bool canExpose, bool shouldRefresh, string messageFragment)
    {
        var presentation = PassengerBoatLocationPolicy.For(status);

        Assert.Equal(canExpose, presentation.CanExposeCoordinates);
        Assert.Equal(shouldRefresh, presentation.ShouldRefresh);
        Assert.Contains(messageFragment, presentation.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void MissingGps_HasPassengerFriendlyMessage()
    {
        var presentation = PassengerBoatLocationPolicy.For(TripStatus.Ongoing);

        Assert.Equal("Waiting for the boat's first GPS update.", presentation.MissingCoordinatesMessage);
    }
}

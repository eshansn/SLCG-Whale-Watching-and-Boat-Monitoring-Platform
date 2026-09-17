using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Operations;

namespace WhaleWatching.Api.Tests;

public sealed class TripWorkflowRulesTests
{
    [Theory]
    [InlineData(TripStatus.Scheduled)]
    [InlineData(TripStatus.Boarding)]
    [InlineData(TripStatus.NeedsReschedule)]
    public void ShoreCanStart_DepartureReadyLifecycleStates(TripStatus status) =>
        Assert.True(TripWorkflowRules.CanStart(status));

    [Theory]
    [InlineData(TripStatus.Ongoing)]
    [InlineData(TripStatus.Completed)]
    [InlineData(TripStatus.Declined)]
    [InlineData(TripStatus.Cancelled)]
    public void ShoreCannotStart_ClosedOrActiveLifecycleStates(TripStatus status) =>
        Assert.False(TripWorkflowRules.CanStart(status));

    [Theory]
    [InlineData(TripStatus.Scheduled, true)]
    [InlineData(TripStatus.Boarding, true)]
    [InlineData(TripStatus.NeedsReschedule, true)]
    [InlineData(TripStatus.Ongoing, false)]
    [InlineData(TripStatus.Completed, false)]
    [InlineData(TripStatus.Declined, false)]
    public void ShoreDecline_FollowsPreStartLifecycle(TripStatus status, bool expected) =>
        Assert.Equal(expected, TripWorkflowRules.CanDecline(status));

    [Theory]
    [InlineData(TripStatus.Ongoing, true)]
    [InlineData(TripStatus.Scheduled, false)]
    [InlineData(TripStatus.Completed, false)]
    [InlineData(TripStatus.Declined, false)]
    public void EndTrip_IsOnlyAvailableWhileOngoing(TripStatus status, bool expected) =>
        Assert.Equal(expected, TripWorkflowRules.CanEnd(status));

    [Fact]
    public void ScheduledTripBeforeNow_IsExpired() =>
        Assert.True(TripWorkflowRules.IsExpiredScheduledTrip(TripStatus.Scheduled,
            DateTimeOffset.Parse("2026-08-01T04:00:00Z"), DateTimeOffset.Parse("2026-08-02T04:00:00Z")));

    [Fact]
    public void ScheduledTripPastDepartureOnSameSriLankaDay_IsNotExpired() =>
        Assert.False(TripWorkflowRules.IsExpiredScheduledTrip(TripStatus.Scheduled,
            DateTimeOffset.Parse("2026-08-01T02:30:00Z"), DateTimeOffset.Parse("2026-08-01T17:00:00Z")));

    [Fact]
    public void ScheduledTrip_BecomesLateThirtyMinutesAfterDeparture()
    {
        var departure = DateTimeOffset.Parse("2026-08-01T02:30:00Z");
        Assert.False(TripWorkflowRules.IsLateScheduledTrip(TripStatus.Scheduled, departure,
            departure.AddMinutes(29)));
        Assert.True(TripWorkflowRules.IsLateScheduledTrip(TripStatus.Scheduled, departure,
            departure.AddMinutes(30)));
    }

    [Theory]
    [InlineData(TripStatus.Ongoing)]
    [InlineData(TripStatus.Completed)]
    public void NonScheduledTrip_IsNotExpired(TripStatus status) =>
        Assert.False(TripWorkflowRules.IsExpiredScheduledTrip(status,
            DateTimeOffset.Parse("2026-08-01T04:00:00Z"), DateTimeOffset.Parse("2026-08-02T04:00:00Z")));

    [Fact]
    public void OnlyPreStartLifecycleStates_CanBeRescheduled()
    {
        Assert.True(TripWorkflowRules.CanReschedule(TripStatus.Scheduled));
        Assert.True(TripWorkflowRules.CanReschedule(TripStatus.Boarding));
        Assert.True(TripWorkflowRules.CanReschedule(TripStatus.NeedsReschedule));
        Assert.False(TripWorkflowRules.CanReschedule(TripStatus.Ongoing));
        Assert.False(TripWorkflowRules.CanReschedule(TripStatus.Completed));
    }
}

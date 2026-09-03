using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Operations;

namespace WhaleWatching.Api.Tests;

public sealed class TripWorkflowRulesTests
{
    [Fact]
    public void WhaleWatchingTrip_RequiresTouristClearance() =>
        Assert.True(TripWorkflowRules.RequiresTouristClearance(TripType.WhaleWatching));

    [Fact]
    public void PatrolTrip_DoesNotRequireTouristClearance() =>
        Assert.False(TripWorkflowRules.RequiresTouristClearance(TripType.Patrol));

    [Fact]
    public void ScheduledTripBeforeNow_IsExpired() =>
        Assert.True(TripWorkflowRules.IsExpiredScheduledTrip(TripStatus.Scheduled,
            DateTimeOffset.Parse("2026-08-01T04:00:00Z"), DateTimeOffset.Parse("2026-08-02T04:00:00Z")));

    [Theory]
    [InlineData(TripStatus.Boarding)]
    [InlineData(TripStatus.Ongoing)]
    [InlineData(TripStatus.Completed)]
    public void NonScheduledTrip_IsNotExpired(TripStatus status) =>
        Assert.False(TripWorkflowRules.IsExpiredScheduledTrip(status,
            DateTimeOffset.Parse("2026-08-01T04:00:00Z"), DateTimeOffset.Parse("2026-08-02T04:00:00Z")));

    [Fact]
    public void OnlyScheduledTrip_CanBeRescheduled()
    {
        Assert.True(TripWorkflowRules.CanReschedule(TripStatus.Scheduled));
        Assert.False(TripWorkflowRules.CanReschedule(TripStatus.Ongoing));
        Assert.False(TripWorkflowRules.CanReschedule(TripStatus.Completed));
    }
}

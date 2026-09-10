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

    [Theory]
    [InlineData(ApprovalStatus.Approved, ApprovalStatus.Pending)]
    [InlineData(ApprovalStatus.Pending, ApprovalStatus.Approved)]
    public void ThreeDepartureApprovals_AreComplete_WhenEitherBoatAuthorityApproved(
        ApprovalStatus administrativeBoatApproval, ApprovalStatus wildlifeBoatApproval) =>
        Assert.Empty(TripWorkflowRules.GetIncompleteTouristApprovals(
            administrativeBoatApproval, wildlifeBoatApproval,
            ApprovalStatus.Approved, ApprovalStatus.Approved));

    [Fact]
    public void MissingDepartureApproval_IsReported()
    {
        var incomplete = TripWorkflowRules.GetIncompleteTouristApprovals(
            ApprovalStatus.Pending, ApprovalStatus.Pending,
            ApprovalStatus.Approved, ApprovalStatus.Pending);

        Assert.Equal(2, incomplete.Count);
        Assert.Contains("boat approval from either Administration or the Wildlife Authority", incomplete);
        Assert.Contains("wildlife shore approval", incomplete);
    }

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
    public void OnlyScheduledTrip_CanBeRescheduled()
    {
        Assert.True(TripWorkflowRules.CanReschedule(TripStatus.Scheduled));
        Assert.True(TripWorkflowRules.CanReschedule(TripStatus.Boarding));
        Assert.False(TripWorkflowRules.CanReschedule(TripStatus.Ongoing));
        Assert.False(TripWorkflowRules.CanReschedule(TripStatus.Completed));
    }
}

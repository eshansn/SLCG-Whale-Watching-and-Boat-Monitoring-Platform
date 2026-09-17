using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Passenger;

public sealed record PassengerBoatLocationPresentation(
    bool CanExposeCoordinates, bool ShouldRefresh, string Message, string MissingCoordinatesMessage);

public static class PassengerBoatLocationPolicy
{
    public static PassengerBoatLocationPresentation For(TripStatus status) => status switch
    {
        TripStatus.Ongoing => new(true, true, "Live boat location", "Waiting for the boat's first GPS update."),
        TripStatus.Completed => new(true, false, "Trip completed · Final recorded boat location", "Trip completed without an available GPS position."),
        TripStatus.NeedsReschedule => new(true, true, "Trip needs rescheduling · Latest boat location", "Trip needs rescheduling. A boat location is not available yet."),
        TripStatus.Scheduled or TripStatus.Boarding => new(true, true, "Latest boat location", "Location will be available when the trip starts."),
        TripStatus.Declined => new(false, false, "Trip declined · Boat tracking is unavailable.", "Trip declined · Boat tracking is unavailable."),
        _ => new(false, false, "Boat tracking is unavailable for this trip.", "Boat tracking is unavailable for this trip.")
    };
}

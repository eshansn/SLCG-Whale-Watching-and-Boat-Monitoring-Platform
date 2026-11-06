using System.Linq.Expressions;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Operations;

internal static class BoatTripApproval
{
    internal const string SchedulingMessage = "Your boat has not yet been approved by the relevant authorities. You must receive official approval before scheduling trips.";
    internal const string DepartureMessage = "This boat does not currently have valid official approval from the relevant authorities. The trip cannot start until approval is granted.";

    // Existing policy permits either authority to approve. Unknown suspension/status
    // values fail closed, including when the other authority field is Approved.
    internal static readonly Expression<Func<Boat, bool>> Eligible = boat => !boat.IsDeleted &&
        (boat.Approval == ApprovalStatus.Pending || boat.Approval == ApprovalStatus.Approved || boat.Approval == ApprovalStatus.Rejected) &&
        (boat.WildlifeApproval == ApprovalStatus.Pending || boat.WildlifeApproval == ApprovalStatus.Approved || boat.WildlifeApproval == ApprovalStatus.Rejected) &&
        (boat.Approval == ApprovalStatus.Approved || boat.WildlifeApproval == ApprovalStatus.Approved);
    private static readonly Func<Boat, bool> IsEligible = Eligible.Compile();
    internal static bool IsApproved(Boat boat) => IsEligible(boat);
}

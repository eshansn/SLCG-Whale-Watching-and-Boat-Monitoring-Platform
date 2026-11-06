import type { Boat } from './operationsApi';

export const boatApprovalSchedulingMessage = 'Your boat has not yet been approved by the relevant authorities. You must receive official approval before scheduling trips.';
export const boatApprovalDepartureMessage = 'This boat does not currently have valid official approval from the relevant authorities. The trip cannot start until approval is granted.';

// Matches the existing either-authority policy. The API rechecks current DB values.
export function isBoatApprovedForTrips(boat: Pick<Boat, 'approval' | 'wildlifeApproval'> | undefined): boolean {
  if (!boat) return false;
  const known = (status: string) => ['Pending', 'Approved', 'Rejected'].includes(status);
  return known(boat.approval) && known(boat.wildlifeApproval) &&
    (boat.approval === 'Approved' || boat.wildlifeApproval === 'Approved');
}

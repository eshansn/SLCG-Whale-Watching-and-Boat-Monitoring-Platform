import type { TripTrackingSummary } from '../../operations/operationsApi';
import type { MonitoringTrip } from '../Complaints/complaintApi';
import { complaintRequest } from '../Complaints/complaintApi';

const requests = new Map<string, { expires: number; promise: Promise<TripTrackingSummary> }>();
type TrackingTrip = Pick<MonitoringTrip, 'id' | 'boatId' | 'status' | 'actualDepartureUtc' | 'actualArrivalUtc'>;

// Brief, bounded, session-scoped caching also coalesces React StrictMode loads
// and keeps passenger pagination from downloading the same route again.
export function loadTripTracking(token: string, trip: TrackingTrip) {
  const key = `${token}:${trip.id}:${trip.boatId}:${trip.status}:${trip.actualDepartureUtc}:${trip.actualArrivalUtc}`;
  const cached = requests.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  if (requests.size >= 32) requests.delete(requests.keys().next().value!);
  const entry = { expires: Date.now() + 15000, promise: complaintRequest<TripTrackingSummary>(token,
    `/api/passenger-monitoring/trips/${trip.id}/tracking-summary`).then(summary => {
      recordedTripTracking(summary, trip); // Reject mismatched trips before caching.
      return summary;
    }).catch((reason: unknown) => { if (requests.get(key) === entry) requests.delete(key); throw reason; }) };
  requests.set(key, entry);
  return entry.promise;
}

export function recordedTripTracking(summary: TripTrackingSummary, trip: TrackingTrip): TripTrackingSummary {
  if (summary.tripId !== trip.id || summary.boatId !== trip.boatId) throw new Error('Tracking information does not match this trip.');
  const start = Date.parse(trip.actualDepartureUtc ?? '');
  const end = Date.parse(trip.actualArrivalUtc ?? '');
  const ongoing = trip.status === 'Ongoing' && !trip.actualArrivalUtc;
  const safeWindow = Number.isFinite(start) && (ongoing || (Number.isFinite(end) && end >= start));
  const route = (summary.route ?? []).filter(point => {
    const timestamp = Date.parse(point.recordedAtUtc);
    return safeWindow && Number.isFinite(timestamp) && timestamp >= start && timestamp <= (ongoing ? Date.now() : end) &&
      Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
      Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
  }).sort((a, b) => Date.parse(a.recordedAtUtc) - Date.parse(b.recordedAtUtc));
  return { ...summary, status: ongoing ? 'Active' : trip.status === 'Completed' || trip.actualArrivalUtc ? 'Completed' : 'NotStarted',
    startedAtUtc: Number.isFinite(start) ? trip.actualDepartureUtc! : undefined,
    endedAtUtc: Number.isFinite(end) && end >= start ? trip.actualArrivalUtc! : undefined,
    currentPosition: ongoing ? route.at(-1) : undefined, route, stops: [],
    routeLength: route.length >= 2 && route.length === summary.route?.length && Number.isFinite(summary.routeLength) ? summary.routeLength : undefined };
}

export function tripDuration(start?: string | null, end?: string | null, ongoing = false) {
  const from = Date.parse(start ?? '');
  const to = ongoing ? Date.now() : Date.parse(end ?? '');
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 'Not recorded';
  const seconds = Math.floor((to - from) / 1000);
  return `${Math.floor(seconds / 3600).toLocaleString('en-LK')}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s${ongoing ? ' so far' : ''}`;
}

import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import type { TripRoutePoint, TripTrackingSummary } from '../../operations/operationsApi';
import type { MonitoringTrip } from '../Complaints/complaintApi';
import { date } from '../Complaints/complaintApi';
import TripRouteMap from '../OPS/components/TripRouteMap';
import { loadTripTracking, recordedTripTracking, tripDuration } from './tripTracking';

const coordinates = (point?: TripRoutePoint) => point ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : 'Not recorded';

export default function SltdaTripTracking({ trip }: { trip: MonitoringTrip }) {
  const { id, boatId, status, actualDepartureUtc, actualArrivalUtc } = trip;
  const { session } = useAuth();
  const token = session?.accessToken;
  const [state, setState] = useState<{ summary?: TripTrackingSummary; error?: string }>();
  const [retry, setRetry] = useState(0);
  const ongoing = trip.status === 'Ongoing' && !trip.actualArrivalUtc;
  useEffect(() => {
    if (!token) return;
    let active = true;
    let timer: number | undefined;
    const load = async () => {
      try {
        const summary = await loadTripTracking(token, { id, boatId, status, actualDepartureUtc, actualArrivalUtc });
        if (active) setState({ summary });
      } catch (reason) {
        if (active) setState({ error: reason instanceof Error ? reason.message : 'Unable to load the GPS route.' });
      } finally {
        if (active && ongoing) timer = window.setTimeout(() => { void load(); }, 15000);
      }
    };
    void load();
    return () => { active = false; window.clearTimeout(timer); };
  }, [token, id, boatId, status, actualDepartureUtc, actualArrivalUtc, ongoing, retry]);

  let summary: TripTrackingSummary | undefined;
  let error = state?.error;
  if (state?.summary) {
    try { summary = recordedTripTracking(state.summary, trip); }
    catch (reason) { error = reason instanceof Error ? reason.message : 'Unable to display this route.'; }
  }
  const route = summary?.route ?? [];
  const finished = trip.status === 'Completed' && !!trip.actualArrivalUtc;
  const statistics = [
    ['Trip start (Sri Lanka time)', trip.actualDepartureUtc ? date(trip.actualDepartureUtc) : 'Not recorded'],
    ['Trip end (Sri Lanka time)', ongoing ? 'In progress' : trip.actualArrivalUtc ? date(trip.actualArrivalUtc) : 'Not recorded'],
    ['Total duration', tripDuration(trip.actualDepartureUtc, trip.actualArrivalUtc, ongoing)],
    ['Start coordinates', coordinates(route[0])],
    [ongoing ? 'Latest recorded coordinates' : 'End coordinates', ongoing ? coordinates(route.at(-1)) : finished ? coordinates(route.at(-1)) : 'Not recorded'],
    ['Recorded route distance', summary?.routeLength == null ? 'Not available' : `${summary.routeLength.toLocaleString('en-LK', { maximumFractionDigits: 2 })} ${summary.routeLengthUnit}`],
    ['Last GPS update (Sri Lanka time)', route.length ? date(route.at(-1)!.recordedAtUtc) : 'Not recorded'],
  ];
  return <section aria-label="Trip GPS history" className="mt-7 min-w-0 border-t border-slate-100 pt-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Recorded trip route</h2>
      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">{ongoing ? 'Ongoing' : trip.status === 'Completed' ? 'Completed' : trip.actualDepartureUtc ? trip.status : 'Not Started'}</span></div>
    <dl className="my-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{statistics.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>
    {!state && <p role="status" className="rounded-xl bg-slate-50 p-8 text-sm text-slate-500">Loading GPS route…</p>}
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => setRetry(value => value + 1)} className="font-semibold underline">Retry GPS route</button></div>}
    {summary && <>
      <TripRouteMap key={trip.id} summary={summary} vesselName={trip.boatName} recordedOnly emptyMessage="No GPS tracker installed" />
      {route.length === 1 && <p className="mt-3 text-xs text-slate-500">Only one GPS point is available. A route cannot be drawn yet.</p>}
      {route.length > 0 && <ul aria-label="Map legend" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
        <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-green-600" />Start location (first recorded point)</li>
        {finished && <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-600" />End location (last recorded point)</li>}
        {ongoing && <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-purple-500" />Latest recorded position</li>}
        <li className="flex items-center gap-2"><span className="h-0.5 w-5 bg-blue-600" />Recorded GPS route</li>
      </ul>}
    </>}
    {ongoing && <p className="mt-3 text-xs text-slate-500">Trip is in progress. The latest recorded position is not the final endpoint.</p>}
  </section>;
}

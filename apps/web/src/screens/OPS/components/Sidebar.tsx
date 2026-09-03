import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Gauge, Info, MapPin, Navigation, X } from 'lucide-react';
import { useAuth } from '../../../auth/useAuth';
import { operationsApi } from '../../../operations/operationsApi';
import { useDashboardStore, type Vessel } from '../store/useDashboardStore';

const HISTORY_RANGES = [
  { label: 'Today', days: 0 },
  { label: '7 Days', days: 7 },
  { label: '14 Days', days: 14 },
  { label: '30 Days', days: 30 },
] as const;

const formatTime = (value?: string) => value
  ? new Intl.DateTimeFormat('en-LK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value))
  : 'TBA';

const formatDateTime = (value?: string) => value
  ? new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'No GPS data available';

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
};

export default function Sidebar() {
  const { activeVesselId, vessels, activeTripTracking, activeTripTrackingBoatId, setActiveVessel } = useDashboardStore();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const selectedVessel = vessels.find((vessel) => vessel.id === activeVesselId);
  const selectedTracking = selectedVessel && activeTripTrackingBoatId === selectedVessel.id
    ? activeTripTracking
    : null;
  const monitoredTripId = selectedVessel?.activeTripId ??
    (selectedTracking?.status === 'Completed' ? selectedTracking.tripId : undefined);

  useGSAP(() => {
    if (activeVesselId) {
      gsap.to(sidebarRef.current, { x: 0, opacity: 1, duration: 0.4, ease: 'power3.out' });
    } else {
      gsap.to(sidebarRef.current, { x: 500, opacity: 0, duration: 0.3, ease: 'power3.in' });
    }
  }, [activeVesselId]);

  return (
    <div
      ref={sidebarRef}
      style={{ transform: 'translateX(500px)', opacity: 0 }}
      className="absolute right-4 top-4 z-50 flex h-[calc(100%-32px)] w-[calc(100%-32px)] max-w-[400px] flex-col overflow-y-auto rounded-3xl border border-slate-100 bg-white shadow-2xl"
    >
      {selectedVessel && (
        <>
          <div className="relative h-48 w-full shrink-0 bg-slate-200">
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-white via-white/20 to-transparent" />
            <img src={selectedVessel.imageUrl || '/gallery-2.jpg'} alt={selectedVessel.name} className="h-full w-full object-cover" />
          </div>

          <div className="relative z-20 -mt-4 px-6 pb-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-3xl font-bold tracking-tight text-[#1A2B4C]">{selectedVessel.name}</h2>
                <Info aria-hidden="true" className="shrink-0 text-slate-400" size={16} />
              </div>
              <button type="button" onClick={() => setActiveVessel(null)} aria-label="Close boat details" className="shrink-0 text-slate-400 transition-colors hover:text-slate-700">
                <X aria-hidden="true" size={19} />
              </button>
            </div>

            <div className="mt-1 flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">{selectedVessel.regNo}</span>
              {monitoredTripId ? (
                <span className={`text-xs font-medium tracking-wide ${selectedVessel.fullyApproved ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {selectedVessel.fullyApproved ? 'Fully approved' : 'Approval pending'}
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">No active trip</span>
              )}
            </div>

            {monitoredTripId
              ? <ActiveTripDetails vessel={selectedVessel} tripId={monitoredTripId} />
              : <NoActiveTripDetails key={selectedVessel.id} vessel={selectedVessel} />}
          </div>
        </>
      )}
    </div>
  );
}

function ActiveTripDetails({ vessel, tripId }: { vessel: Vessel; tripId: string }) {
  const { session } = useAuth();
  const {
    activeTripTracking,
    activeTripTrackingBoatId,
    activeTripTrackingLoading,
    activeTripTrackingError,
    loadActiveTripTracking,
  } = useDashboardStore();
  const tracking = activeTripTrackingBoatId === vessel.id && activeTripTracking?.tripId === tripId
    ? activeTripTracking
    : null;

  useEffect(() => {
    if (!session) return;
    void loadActiveTripTracking(session.accessToken, vessel.id, tripId);
  }, [loadActiveTripTracking, session, tripId, vessel.id]);

  return (
    <>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
        {[
          ['Certified', vessel.certificationApproval],
          ['Wildlife', vessel.wildlifeApproval],
          ['Shore', vessel.shoreApproval],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-2 py-2">
            <div className="font-semibold text-[#1A2B4C]">{label}</div>
            <div className={value === 'Approved' ? 'text-emerald-600' : value === 'Rejected' ? 'text-red-600' : 'text-amber-600'}>{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        <DetailRow label="Coordinates" value={`${vessel.lat.toFixed(6)}, ${vessel.lon.toFixed(6)}`} />
        <DetailRow label="Tracker" value={vessel.trackerStatus} />
        <DetailRow label="GPS recorded" value={formatDateTime(vessel.coordinatesRecordedAtUtc)} />
        <DetailRow label="Departure" value={formatTime(vessel.departureUtc)} />
        <DetailRow label="Arrival" value={formatTime(vessel.arrivalUtc)} />
      </div>

      <div className="mt-6 rounded-xl bg-[#F8F9FA] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-[#1A2B4C]">Live Trip Route</h3>
          {tracking && <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${tracking.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{tracking.status}</span>}
        </div>
        {activeTripTrackingLoading && !tracking && <p className="mt-3 text-xs text-slate-500">Loading travelled route…</p>}
        {activeTripTrackingError && !tracking && <div className="mt-3 text-xs text-red-600"><p>{activeTripTrackingError}</p>{session && <button type="button" onClick={() => void loadActiveTripTracking(session.accessToken, vessel.id, tripId)} className="mt-2 font-semibold underline">Retry</button>}</div>}
        {tracking && tracking.route.length === 0 && <p className="mt-3 text-xs text-slate-500">Waiting for GPS data</p>}
        {tracking && tracking.route.length > 0 && <dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><StatusRow label="Route points" value={tracking.route.length.toString()} /><StatusRow label="Stops" value={tracking.stops.length.toString()} /><StatusRow label="Last point" value={formatTime(tracking.currentPosition?.recordedAtUtc)} /><StatusRow label="Stop time" value={formatDuration(tracking.stopsDurationSeconds ?? 0)} /></dl>}
      </div>

      <div className="mt-6 space-y-4">
        <InformationCard title="Vessel Information" rows={[
          ['Length', `${vessel.lengthMeters} m`],
          ['Beam (Width)', `${vessel.beamMeters} m`],
          ['Live Speed', vessel.cruisingSpeedKnots == null ? 'No GPS reading' : `${vessel.cruisingSpeedKnots} knots`],
          ['Maximum Speed', `${vessel.maximumSpeedKnots} knots`],
          ['Maximum Capacity', `${vessel.maximumCapacity} passengers`],
          ['Life Jackets', vessel.lifeJacketCount.toString()],
        ]} />
        <InformationCard title="Passenger Information" showMore rows={[
          ['Passengers Onboard', vessel.passengerCount.toString()],
          ['Children Onboard', vessel.childrenCount.toString()],
          ['Special Needs', vessel.specialNeedsCount.toString()],
        ]} />
        <InformationCard title="Crew Information" showMore rows={[
          ['Life Savers', vessel.lifeSaverCount.toString()],
          ['Divers', vessel.diverCount.toString()],
          ['Coxswains', vessel.coxswainCount.toString()],
        ]} />
      </div>
    </>
  );
}

function NoActiveTripDetails({ vessel }: { vessel: Vessel }) {
  const { session } = useAuth();
  const { routeHistory, routeHistoryBoatId, setRouteHistory, clearRouteHistory } = useDashboardStore();
  const [rangeDays, setRangeDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryVersion, setRetryVersion] = useState(0);
  const history = routeHistoryBoatId === vessel.id ? routeHistory : null;

  useEffect(() => {
    if (!session) return;
    let active = true;
    clearRouteHistory();

    const to = new Date();
    const from = rangeDays === 0
      ? new Date(to.getFullYear(), to.getMonth(), to.getDate())
      : new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);

    void operationsApi.boatRouteHistory(session.accessToken, vessel.id, from.toISOString(), to.toISOString())
      .then((nextHistory) => {
        if (!active) return;
        setRouteHistory(vessel.id, nextHistory);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load route history.');
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [clearRouteHistory, rangeDays, retryVersion, session, setRouteHistory, vessel.id]);

  const hasGps = Boolean(vessel.coordinatesRecordedAtUtc);
  const hasRoutePoints = Boolean(history && [
    ...history.trips.map((trip) => trip.route),
    ...history.unassignedRoutes.map((route) => route.route),
  ].some((route) => route.length > 0));
  const recentRoutes = history ? [
    ...history.trips.map((trip) => ({
      id: trip.tripId,
      title: trip.routeName || 'Recorded trip',
      startedAtUtc: trip.startedAtUtc,
      endedAtUtc: trip.endedAtUtc,
      distance: trip.routeLength,
      hasPoints: trip.route.length > 0,
    })),
    ...history.unassignedRoutes.map((route) => ({
      id: `unassigned-${route.segmentNumber}`,
      title: 'Movement outside a trip',
      startedAtUtc: route.startedAtUtc,
      endedAtUtc: route.endedAtUtc,
      distance: route.routeLength,
      hasPoints: route.route.length > 0,
    })),
  ].sort((a, b) => new Date(b.startedAtUtc).getTime() - new Date(a.startedAtUtc).getTime()) : [];

  return (
    <>
      <div className="mt-6 rounded-xl bg-[#F8F9FA] p-4">
        <h3 className="font-bold text-[#1A2B4C]">Boat & GPS Status</h3>
        <div className="mt-3 space-y-2 text-sm">
          <StatusRow label="Boat status" value="Idle" />
          <StatusRow label="Tracker" value={hasGps ? vessel.trackerStatus : 'Offline'} />
          {hasGps && (
            <>
              <StatusRow label="Last location" value={`${vessel.lat.toFixed(6)}, ${vessel.lon.toFixed(6)}`} icon={<MapPin size={14} />} />
              <StatusRow label="Last seen" value={formatDateTime(vessel.coordinatesRecordedAtUtc)} />
              <StatusRow label="Last speed" value={vessel.cruisingSpeedKnots == null ? 'No speed reading' : `${vessel.cruisingSpeedKnots} knots`} icon={<Gauge size={14} />} />
            </>
          )}
        </div>
      </div>

      <section className="mt-4">
        <div className="flex items-center gap-2">
          <Navigation aria-hidden="true" size={17} className="text-[#1A2B4C]" />
          <div>
            <h3 className="font-bold text-[#1A2B4C]">Route History</h3>
            <p className="text-[10px] text-slate-400">Travelled paths for the selected period</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
          {HISTORY_RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              onClick={() => {
                if (rangeDays === range.days) return;
                clearRouteHistory();
                setLoading(true);
                setError('');
                setRangeDays(range.days);
              }}
              className={`rounded-lg px-1 py-2 text-[10px] font-semibold transition-colors ${rangeDays === range.days ? 'bg-white text-[#1A2B4C] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="mt-4 space-y-3" aria-label="Loading route history">
            <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-xs text-red-700">
            <p>{error}</p>
            <button type="button" onClick={() => {
              clearRouteHistory();
              setLoading(true);
              setError('');
              setRetryVersion((value) => value + 1);
            }} className="mt-2 font-semibold underline">Retry</button>
          </div>
        )}

        {!loading && !error && history && hasRoutePoints && (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              <HistoryStat label="Total Distance" value={`${history.summary.totalDistance.toFixed(2)} ${history.summary.distanceUnit}`} />
              <HistoryStat label="Trips" value={history.summary.totalTrips.toString()} />
              <HistoryStat label="Moving Time" value={formatDuration(history.summary.movingDurationSeconds)} />
              <HistoryStat label="Stop Time" value={formatDuration(history.summary.stopsDurationSeconds)} />
              <HistoryStat label="Average Speed" value={history.summary.averageSpeed == null ? 'No movement data' : `${history.summary.averageSpeed.toFixed(1)} ${history.summary.speedUnit}`} wide />
            </dl>

            <div className="mt-5">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Recent Routes</h4>
              <div className="mt-2 space-y-2">
                {recentRoutes.map((route) => (
                  <div key={route.id} className="rounded-xl border border-slate-100 bg-[#F8F9FA] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[#1A2B4C]">{route.title}</p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium' }).format(new Date(route.startedAtUtc))}
                          {' · '}{formatTime(route.startedAtUtc)} – {route.endedAtUtc ? formatTime(route.endedAtUtc) : 'In progress'}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-slate-600">
                        {!route.hasPoints ? 'No GPS' : route.distance == null ? '1 point' : `${route.distance.toFixed(1)} km`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!loading && !error && history && !hasRoutePoints && (
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
            No GPS route history available for the selected period.
          </div>
        )}
      </section>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[100px_1fr] text-sm"><span className="font-bold text-[#1A2B4C]">{label}</span><span className="text-slate-600">{value}</span></div>;
}

function StatusRow({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return <div className="grid grid-cols-[105px_1fr] gap-2"><span className="font-semibold text-[#1A2B4C]">{label}</span><span className="flex min-w-0 items-center gap-1.5 break-words text-slate-600">{icon}{value}</span></div>;
}

function InformationCard({ title, rows, showMore = false }: { title: string; rows: string[][]; showMore?: boolean }) {
  return (
    <div className="group relative rounded-xl bg-[#F8F9FA] p-4">
      {showMore && <span className="absolute right-4 top-4 text-[10px] font-bold text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">More Info</span>}
      <h3 className="mb-3 font-bold text-[#1A2B4C]">{title}</h3>
      <div className="space-y-2 text-sm">
        {rows.map(([label, value]) => <div key={label} className="grid grid-cols-[140px_1fr]"><span className="font-semibold text-[#1A2B4C]">{label}</span><span className="text-slate-600">{value}</span></div>)}
      </div>
    </div>
  );
}

function HistoryStat({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`rounded-xl bg-[#F8F9FA] p-3 ${wide ? 'col-span-2' : ''}`}><dt className="text-[10px] font-semibold text-slate-400">{label}</dt><dd className="mt-1 text-sm font-bold text-[#1A2B4C]">{value}</dd></div>;
}

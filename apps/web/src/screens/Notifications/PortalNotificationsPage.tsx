import { useMemo } from 'react';
import { ArrowLeft, Bell, Home, Ship } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatTripDate } from '../../operations/operationsApi';
import { useOperations } from '../../operations/useOperations';

type NotificationPortal = 'owner' | 'shore' | 'admin' | 'wildlife';

const portalCopy: Record<NotificationPortal, { description: string; home: string }> = {
  owner: { description: 'Live updates for your trips and their approval status.', home: '/owner' },
  shore: { description: 'Trips requiring shore review and their latest operational status.', home: '/shore' },
  admin: { description: 'Latest trip, approval, and operational changes across the system.', home: '/admin' },
  wildlife: { description: 'Latest trip and approval changes relevant to wildlife operations.', home: '/wildlife' },
};

export default function PortalNotificationsPage({ portal }: { portal: NotificationPortal }) {
  const navigate = useNavigate();
  const { trips, loading, error, reload } = useOperations();
  const items = useMemo(() => [...trips].sort((left, right) =>
    +new Date(right.updatedAtUtc) - +new Date(left.updatedAtUtc)), [trips]);
  const copy = portalCopy[portal];

  const openTrip = (tripId: string) => {
    const path = portal === 'owner'
      ? `/owner/trips/${tripId}`
      : portal === 'shore'
        ? `/shore/trips/${tripId}`
        : `/${portal}/trip-info/${tripId}`;
    navigate(path);
  };

  const content = (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-100 px-5 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Bell size={20} /></span>
          <div>
            <h1 className="text-xl font-semibold text-[#14223d]">Notifications</h1>
            <p className="mt-1 text-xs text-slate-500">{copy.description}</p>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="m-5 flex items-center justify-between gap-4 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700 sm:m-8">
          <span>{error}</span>
          <button type="button" onClick={() => void reload()} className="shrink-0 font-semibold underline">Retry</button>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="space-y-3 p-5 sm:p-8" aria-label="Loading notifications">
          {[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : items.length === 0 && !error ? (
        <div className="px-6 py-16 text-center">
          <Bell className="mx-auto text-slate-300" size={30} />
          <p className="mt-4 text-sm font-medium text-slate-600">No notifications available.</p>
          <p className="mt-1 text-xs text-slate-400">New trip and approval updates will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((trip) => (
            <button key={trip.id} type="button" onClick={() => openTrip(trip.id)} className="flex w-full gap-4 px-5 py-5 text-left transition hover:bg-slate-50 sm:px-8">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Ship size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#14223d]">{trip.vesselName} trip update</span>
                    <span className="mt-1 block text-xs text-slate-500">{trip.registrationNumber} · Departure {formatTripDate(trip.scheduledDepartureUtc)}</span>
                  </span>
                  <Status value={trip.status} />
                </span>
                <span className="mt-2 block text-xs leading-5 text-slate-500">Trip lifecycle: {trip.status}{trip.rescheduleOverride?' · Started with Shore override':''}</span>
                <time className="mt-2 block text-[10px] text-slate-400">Updated {formatTripDate(trip.updatedAtUtc)}</time>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );

  if (portal !== 'owner') {
    return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{content}</main>;
  }

  return (
    <main className="boat-owner-page min-h-dvh bg-[#f7f9fc] text-[#14223d]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => navigate(copy.home)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100" aria-label="Back to owner dashboard">
            <ArrowLeft size={18} /><span className="hidden sm:inline">Dashboard</span>
          </button>
          <img src="/SLCG.png" alt="Sri Lanka Coast Guard" className="h-9 w-auto" />
          <button type="button" onClick={() => navigate(copy.home)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100" aria-label="Owner dashboard">
            <Home size={19} />
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{content}</div>
    </main>
  );
}

function Status({ value }: { value: string }) {
  const tone = ['Approved', 'Completed'].includes(value)
    ? 'bg-emerald-50 text-emerald-700'
    : value === 'Ongoing'
      ? 'bg-blue-50 text-blue-700'
      : value === 'Cancelled'
        ? 'bg-red-50 text-red-700'
        : 'bg-amber-50 text-amber-700';
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone}`}>{value}</span>;
}

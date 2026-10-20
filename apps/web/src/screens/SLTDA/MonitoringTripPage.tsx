import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MonitoringTrip, Page } from '../Complaints/complaintApi';
import { date } from '../Complaints/complaintApi';
import { LoadState, Pagination, StatusBadge } from '../Complaints/ComplaintComponents';
import { useComplaintPortal } from '../Complaints/useComplaintPortal';
import { useComplaintData } from '../Complaints/useComplaintData';

export default function MonitoringTripPage() {
  const { id } = useParams();
  const { base } = useComplaintPortal();
  const [page, setPage] = useState(1);
  const state = useComplaintData<{ trip: MonitoringTrip; participants: Page<{ passengerId: string; name: string; registeredAtUtc: string; attendance: string }> }>(`/api/passenger-monitoring/trips/${id}?page=${page}`, true);
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><Link to={`${base}/passengers`} className="text-sm text-slate-500">← Passenger monitoring</Link><LoadState {...state} />
    {state.data && <section className="mt-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">{state.data.trip.boatName}</h1><StatusBadge value={state.data.trip.status} /></div>
      <p className="mt-2 text-sm text-slate-500">{state.data.trip.registrationNumber} · Operator: {state.data.trip.ownerName}</p><p className="mt-4 text-sm">{state.data.trip.route}</p>
      <p className="mt-4 text-xs leading-6 text-slate-500">Scheduled: {date(state.data.trip.scheduledDepartureUtc)}<br />Departed: {date(state.data.trip.actualDepartureUtc)}<br />Arrived: {date(state.data.trip.actualArrivalUtc)}</p>
      <h2 className="mt-7 text-lg font-semibold">Registered passengers ({state.data.trip.registeredPassengers})</h2><div className="mt-3 divide-y divide-slate-100">{state.data.participants.items.map(p => <article key={p.passengerId} className="flex flex-wrap justify-between gap-3 py-4"><div><Link to={`${base}/passengers/${p.passengerId}`} className="text-sm font-semibold text-indigo-700">{p.name} →</Link><p className="mt-1 text-xs text-slate-400">Registered {date(p.registeredAtUtc)}</p></div><span className="text-xs text-slate-500">Attendance: {p.attendance}</span></article>)}{!state.data.participants.items.length && <p className="py-8 text-sm text-slate-500">No passenger registrations.</p>}</div><Pagination page={page} total={state.data.participants.total} onChange={setPage} />
    </section>}
  </main>;
}

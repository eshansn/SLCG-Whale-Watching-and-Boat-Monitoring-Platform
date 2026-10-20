import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PassengerCountryDisplay } from '../../components/CountryFlag';
import type { ComplaintSummary, Page, Passenger, PassengerTrip } from '../Complaints/complaintApi';
import { date } from '../Complaints/complaintApi';
import { LoadState, Pagination, StatusBadge } from '../Complaints/ComplaintComponents';
import { useComplaintPortal } from '../Complaints/useComplaintPortal';
import { useComplaintData } from '../Complaints/useComplaintData';

export default function PassengerProfilePage() {
  const { id } = useParams();
  const { base } = useComplaintPortal();
  const [tripPage, setTripPage] = useState(1);
  const [casePage, setCasePage] = useState(1);
  const profile = useComplaintData<Passenger>(`/api/passenger-monitoring/passengers/${id}`, true);
  const trips = useComplaintData<Page<PassengerTrip>>(`/api/passenger-monitoring/passengers/${id}/trips?page=${tripPage}`, true);
  const cases = useComplaintData<Page<ComplaintSummary>>(`/api/complaint-workflow?passengerId=${id}&page=${casePage}`, true);
  const p = profile.data;
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8"><Link to={`${base}/passengers`} className="text-sm text-slate-500">← Passenger monitoring</Link><LoadState {...profile} />
    {p && <><section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><h1 className="text-2xl font-semibold">{p.name}</h1><p className="mt-2 break-all text-xs text-slate-400">Passenger ID: {p.id}</p>
      <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">{[['Identification', p.identificationNumber], ['Contact', p.phoneNumber], ['Registration date', date(p.createdAtUtc)], ['Passenger type / country', p.passengerType], ['Gender / age category', `${p.gender} / ${p.ageCategory}`], ['Registered trips', p.tripCount], ['Complaints', p.complaintCount], ['Inquiries', p.inquiryCount]].map(([name, value]) => <div key={name}><dt className="text-xs text-slate-400">{name}</dt><dd className="mt-1">{name === 'Passenger type / country' ? <PassengerCountryDisplay passengerType={p.passengerType} countryCode={p.countryCode ?? undefined} /> : value}</dd></div>)}</dl></section>
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold">Trip & registration history</h2><LoadState {...trips} />{trips.data && <><div className="mt-3 divide-y divide-slate-100">{trips.data.items.map(t => <article key={t.tripId} className="flex flex-wrap items-start justify-between gap-3 py-5"><div><Link to={`${base}/monitoring-trips/${t.tripId}`} className="font-semibold text-indigo-700">{t.boatName} · {t.registrationNumber} →</Link><p className="mt-2 text-sm text-slate-500">{t.route}</p><p className="mt-2 text-xs leading-6 text-slate-400">Scheduled: {date(t.scheduledDepartureUtc)}<br />Registered: {date(t.registeredAtUtc)} · Attendance: {t.attendance}</p></div><StatusBadge value={t.status} /></article>)}{!trips.data.items.length && <p className="py-8 text-sm text-slate-500">No trip registrations recorded.</p>}</div><Pagination page={tripPage} total={trips.data.total} onChange={setTripPage} /></>}</section>
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold">Complaints & inquiries</h2><LoadState {...cases} />{cases.data && <><div className="mt-3 divide-y divide-slate-100">{cases.data.items.map(c => <article key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-5"><div><Link to={`${base}/complaints/${c.id}`} className="break-all text-sm font-semibold text-indigo-700">{c.reference}</Link><p className="mt-1 text-sm text-slate-500">{c.kind} · {c.type}</p><p className="mt-2 text-xs text-slate-400">{date(c.createdAtUtc)}</p></div><StatusBadge value={c.status} /></article>)}{!cases.data.items.length && <p className="py-8 text-sm text-slate-500">No complaints or inquiries recorded.</p>}</div><Pagination page={casePage} total={cases.data.total} onChange={setCasePage} /></>}</section>
    </>}
  </main>;
}

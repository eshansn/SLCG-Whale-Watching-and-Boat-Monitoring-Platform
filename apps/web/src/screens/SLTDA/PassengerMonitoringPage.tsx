import { Link, useSearchParams } from 'react-router-dom';
import { UsersRound } from 'lucide-react';
import { PassengerCountryDisplay } from '../../components/CountryFlag';
import type { Page, Passenger } from '../Complaints/complaintApi';
import { date, inputClass } from '../Complaints/complaintApi';
import { LoadState, Pagination } from '../Complaints/ComplaintComponents';
import { useComplaintPortal } from '../Complaints/useComplaintPortal';
import { useComplaintData } from '../Complaints/useComplaintData';

export default function PassengerMonitoringPage() {
  const { base } = useComplaintPortal();
  const [params, setParams] = useSearchParams();
  const filters = { search: params.get('search') ?? '', passengerType: params.get('passengerType') ?? '', country: params.get('country') ?? '',
    sort: params.get('sort') ?? 'newest', from: params.get('from') ?? '', to: params.get('to') ?? '', page: Math.max(1, Number(params.get('page')) || 1) };
  const state = useComplaintData<Page<Passenger>>(`/api/passenger-monitoring/passengers?${params}`, true);
  const update = (name: string, value: string) => setParams(current => { const next = new URLSearchParams(current); if (value) next.set(name, value); else next.delete(name); next.delete('page'); return next; });
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
    <h1 className="flex items-center gap-3 text-2xl font-semibold"><UsersRound className="text-indigo-600" />Passenger monitoring</h1><p className="mt-2 text-sm text-slate-500">System-wide registration details and historical activity.</p>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input aria-label="Search passengers" className={inputClass} placeholder="Name, identifier, phone, or passenger ID" value={filters.search} onChange={e => update('search', e.target.value)} />
      <select aria-label="Passenger type" className={inputClass} value={filters.passengerType} onChange={e => update('passengerType', e.target.value)}><option value="">All passenger types</option><option value="local">Local</option><option value="foreign">Foreign</option></select>
      <input aria-label="Country code" maxLength={2} className={inputClass} placeholder="Country code (e.g. LK)" value={filters.country} onChange={e => update('country', e.target.value.toUpperCase())} />
      <select aria-label="Sort passengers" className={inputClass} value={filters.sort} onChange={e => update('sort', e.target.value)}><option value="newest">Newest registrations</option><option value="oldest">Oldest registrations</option><option value="name">Name A–Z</option></select></div>
    <div className="mt-3 flex flex-wrap items-end gap-3"><label className="text-xs text-slate-500">Registered from<input type="date" value={filters.from} onChange={e => update('from', e.target.value)} className={`mt-1 ${inputClass}`} /></label><label className="text-xs text-slate-500">Registered through<input type="date" value={filters.to} onChange={e => update('to', e.target.value)} className={`mt-1 ${inputClass}`} /></label>{params.size > 0 && <button type="button" onClick={() => setParams({})} className="min-h-10 rounded-lg px-3 text-xs font-medium text-indigo-600 hover:bg-indigo-50">Clear filters</button>}<p className="mb-3 text-[11px] text-slate-400">Registration dates use Sri Lanka time.</p></div>
    <LoadState {...state} />{state.data && <><div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-400"><tr>{['Passenger', 'Identifier / contact', 'Registered', 'Activity', ''].map(h => <th key={h} className="whitespace-nowrap px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{state.data.items.map(p => <tr key={p.id} className="hover:bg-slate-50"><td className="px-3 py-4"><Link to={`${base}/passengers/${p.id}`} className="font-semibold text-indigo-700 hover:underline">{p.name}</Link><p className="mt-1 text-xs text-slate-400"><PassengerCountryDisplay passengerType={p.passengerType} countryCode={p.countryCode ?? undefined} /></p></td><td className="px-3 py-4">{p.identificationNumber}<p className="mt-1 text-xs text-slate-500">{p.phoneNumber}</p></td><td className="whitespace-nowrap px-3 py-4 text-xs text-slate-500">{date(p.createdAtUtc)}</td><td className="px-3 py-4 text-xs leading-6 text-slate-500">{p.tripCount} trips<br />{p.complaintCount} complaints · {p.inquiryCount} inquiries</td><td className="px-3 py-4"><Link to={`${base}/passengers/${p.id}`} className="text-xs font-semibold text-indigo-700">View profile →</Link></td></tr>)}</tbody></table>{!state.data.items.length && <p className="py-14 text-center text-sm text-slate-500">No passengers match these filters.</p>}</div><Pagination page={filters.page} total={state.data.total} onChange={page => setParams(current => { const next = new URLSearchParams(current); next.set('page', String(page)); return next; })} /></>}
  </section></main>;
}

import { Link, useSearchParams } from 'react-router-dom';
import { FileWarning, Search } from 'lucide-react';
import { caseFilterDay, complaintStatuses, date, inputClass, label } from './complaintApi';
import type { Authority, ComplaintSummary, Page } from './complaintApi';
import { CaseKindBadge, ComplaintUpdatesLink, LoadState, Pagination, StatusBadge } from './ComplaintComponents';
import { useComplaintPortal } from './useComplaintPortal';
import { useComplaintData } from './useComplaintData';

export default function ComplaintListPage() {
  const { base, monitor, monitorBase } = useComplaintPortal();
  const [url, setUrl] = useSearchParams();
  const filters = { search: url.get('search') ?? '', status: url.get('status') ?? '', kind: url.get('kind') ?? '', authorityRoleId: url.get('authorityRoleId') ?? '',
    queue: url.get('queue') ?? '', from: caseFilterDay(url.get('from')), to: caseFilterDay(url.get('to'), true), sort: url.get('sort') ?? 'newest', page: Math.max(1, Number(url.get('page')) || 1) };
  const params = new URLSearchParams(url);
  if (filters.from) params.set('from', new Date(`${filters.from}T00:00:00+05:30`).toISOString());
  if (filters.to) params.set('to', new Date(new Date(`${filters.to}T00:00:00+05:30`).getTime() + 86400000).toISOString());
  const records = useComplaintData<Page<ComplaintSummary>>(`/api/complaint-workflow?${params}`, true);
  const authorities = useComplaintData<Authority[]>(monitor ? '/api/complaint-workflow/authorities' : null);
  const update = (name: string, value: string) => setUrl(current => { const next = new URLSearchParams(current); if (value) next.set(name, value); else next.delete(name); next.delete('page'); return next; });
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5"><div className="flex items-start gap-3"><span className="rounded-xl bg-indigo-50 p-3 text-indigo-700"><FileWarning size={23} /></span>
        <div><h1 className="text-2xl font-semibold">{base === '/sltda' ? 'Complaints & inquiries' : monitor ? 'Complaint oversight' : 'Assigned complaints'}</h1>
          <p className="mt-2 text-sm text-slate-500">{monitor ? 'Review passenger complaints and inquiries, coordinate authorities, and track every response.' : 'Acknowledge referrals and record official responses for your authority.'}</p></div></div>
        <div className="flex flex-wrap items-center gap-3">{monitor && <Link to={`${monitorBase}/passengers`} className="text-sm font-medium text-indigo-700 hover:underline">Passenger monitoring</Link>}<ComplaintUpdatesLink base={base} /></div></div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative"><span className="sr-only">Search complaints</span><Search size={16} className="absolute right-3 top-3 text-slate-400" />
          <input value={filters.search} onChange={e => update('search', e.target.value)} placeholder="Reference, passenger, or description" className={`${inputClass} pr-9`} /></label>
        <select aria-label="Complaint status" value={filters.status} onChange={e => update('status', e.target.value)} className={inputClass}><option value="">All statuses</option>{complaintStatuses.map(s => <option key={s} value={s}>{label(s)}</option>)}</select>
        <select aria-label="Record kind" value={filters.kind} onChange={e => update('kind', e.target.value)} className={inputClass}><option value="">Complaints and inquiries</option><option>Complaint</option><option>Inquiry</option><option>Unclassified</option></select>
        <select aria-label="Sort complaints" value={filters.sort} onChange={e => update('sort', e.target.value)} className={inputClass}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="updated">Recently updated</option><option value="passenger">Passenger A–Z</option></select>
        {monitor && <select aria-label="Receiving authority" value={filters.authorityRoleId} onChange={e => update('authorityRoleId', e.target.value)} className={inputClass}><option value="">All authorities</option>{Array.isArray(authorities.data) && authorities.data.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
        <select aria-label="Case queue" value={filters.queue} onChange={e => update('queue', e.target.value)} className={inputClass}><option value="">All queues</option><option value="open">Open cases</option><option value="completed">Resolved or closed</option><option value="awaiting-review">Awaiting review</option><option value="awaiting-ack">Awaiting acknowledgment</option><option value="awaiting-response">Awaiting authority responses</option></select>
        <label className="text-xs text-slate-500">Submitted from<input type="date" value={filters.from} onChange={e => update('from', e.target.value)} className={`mt-1 ${inputClass}`} /></label>
        <label className="text-xs text-slate-500">Submitted through<input type="date" value={filters.to} onChange={e => update('to', e.target.value)} className={`mt-1 ${inputClass}`} /></label>
      </div>
      {url.size > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500"><span>Showing records that match the selected filters{filters.from || filters.to ? ' · Dates in Sri Lanka time' : ''}</span><button type="button" onClick={() => setUrl({})} className="font-medium text-indigo-600 hover:underline">Clear filters</button></div>}
      <LoadState {...records} />
      {records.data && <><div className="mt-6 divide-y divide-slate-100">
        {records.data.items.map(c => <article key={c.id} className="grid gap-3 py-5 md:grid-cols-[minmax(0,1.7fr)_1fr_auto] md:items-center">
          <div><Link to={`${base}/complaints/${c.id}`} className="break-all text-sm font-semibold text-indigo-700 hover:underline">{c.reference}</Link><p className="mt-2 flex flex-wrap items-center gap-2 text-sm"><CaseKindBadge value={c.kind} />{c.type}</p>
            <p className="mt-1 text-xs text-slate-500">Submitted {date(c.createdAtUtc)} · Updated {date(c.updatedAtUtc)}</p></div>
          <div>{monitor ? <Link to={`${monitorBase}/passengers/${c.passengerId}`} className="text-sm font-medium text-indigo-700 hover:underline">{c.passengerName}</Link> : <p className="text-sm font-medium">{c.passengerName}</p>}
            <p className="mt-1 text-xs text-slate-500">{c.boatName}</p></div>
          <div className="space-y-2 md:text-right"><StatusBadge value={c.status} /><p className="text-xs text-slate-500">{c.pendingAuthorities} {monitor ? 'authorities' : 'of your assignments'} awaiting response</p></div>
        </article>)}
        {!records.data.items.length && <p className="py-14 text-center text-sm text-slate-500">No complaints or inquiries match these filters.</p>}
      </div><Pagination page={filters.page} total={records.data.total} onChange={page => setUrl(current => { const next = new URLSearchParams(current); next.set('page', String(page)); return next; })} /></>}
    </section>
  </main>;
}

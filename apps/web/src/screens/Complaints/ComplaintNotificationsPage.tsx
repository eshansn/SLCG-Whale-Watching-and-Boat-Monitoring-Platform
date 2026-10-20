import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { complaintRequest, date } from './complaintApi';
import type { Notification, Page } from './complaintApi';
import { LoadState, Pagination } from './ComplaintComponents';
import { useComplaintPortal } from './useComplaintPortal';
import { useComplaintData } from './useComplaintData';

export default function ComplaintNotificationsPage() {
  const { base } = useComplaintPortal();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const state = useComplaintData<Page<Notification> & { unread: number }>(`/api/complaint-notifications?page=${page}`, true);
  const read = async (item: Notification, value: boolean, open = false) => {
    if (!state.token || busy) return;
    setBusy(item.id); setError('');
    try {
      await complaintRequest(state.token, `/api/complaint-notifications/${item.id}/read`, { read: value }, 'PUT');
      state.reload();
      if (open) navigate(`${base}/complaints/${item.complaintId}${item.assignmentId ? `#assignment-${item.assignmentId}` : ''}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update notification.'); }
    finally { setBusy(null); }
  };
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><Link to={`${base}/complaints`} className="mb-5 inline-block text-sm text-slate-500">← Complaints and inquiries</Link><section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-50 p-3 text-indigo-700"><Bell size={23} /></span><div><h1 className="text-2xl font-semibold">Complaint notifications</h1><p className="mt-1 text-sm text-slate-500">{state.data ? `${state.data.unread} unread updates` : 'Referrals, acknowledgments, and official response updates'}</p></div></div>
    <LoadState {...state} />{error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {state.data && <><div className="mt-6 divide-y divide-slate-100">{state.data.items.map(n => <article key={n.id} className={`flex flex-wrap items-center justify-between gap-4 rounded-xl px-4 py-5 ${n.readAtUtc ? '' : 'bg-indigo-50/60'}`}>
      <button type="button" disabled={!!busy} onClick={() => void read(n, true, true)} className="min-w-0 flex-1 text-left"><span className="break-all text-sm font-semibold text-indigo-700">{n.reference}</span><span className="mt-1 block text-sm">{n.action} · {n.category}</span><span className="mt-2 block text-xs text-slate-500">{n.sender} · {date(n.createdAtUtc)}</span></button>
      <button type="button" disabled={!!busy} onClick={() => void read(n, !n.readAtUtc)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 disabled:opacity-50">Mark {n.readAtUtc ? 'unread' : 'read'}</button>
    </article>)}{!state.data.items.length && <p className="py-14 text-center text-sm text-slate-500">No complaint notifications yet.</p>}</div>
      <Pagination page={page} total={state.data.total} onChange={setPage} /></>}
  </section></main>;
}

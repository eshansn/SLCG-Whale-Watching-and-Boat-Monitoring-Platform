import { Bell, FileWarning } from 'lucide-react';
import { Link } from 'react-router-dom';
import { label } from './complaintApi';
import { useComplaintData } from './useComplaintData';

export function ComplaintNavLink({ base }: { base: string }) {
  return <Link to={`${base}/complaints`} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-[#14223d]"><FileWarning size={18} />Complaints</Link>;
}

export function ComplaintUpdatesLink({ base }: { base: string }) {
  const { data } = useComplaintData<{ unread: number }>('/api/complaint-notifications/unread-count', true);
  return <Link to={`${base}/complaint-notifications`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><Bell size={16} />Complaint updates
    {data && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700" aria-label={`${data.unread} unread complaint notifications`}>{data.unread}</span>}</Link>;
}

export function StatusBadge({ value }: { value: string }) {
  const color = ['Resolved', 'Closed', 'Responded'].includes(value) ? 'bg-emerald-50 text-emerald-700' :
    ['Submitted', 'Pending', 'Reopened', 'Forwarded'].includes(value) ? 'bg-amber-50 text-amber-800' : 'bg-indigo-50 text-indigo-700';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>{label(value)}</span>;
}
export function CaseKindBadge({ value }: { value: string }) {
  const known = value === 'Complaint' || value === 'Inquiry';
  const color = value === 'Complaint' ? 'border-amber-200/70 bg-amber-50 text-amber-800' : value === 'Inquiry' ? 'border-violet-200/70 bg-violet-50 text-violet-700' : 'border-slate-200 bg-slate-50 text-slate-600';
  return <span title={known ? undefined : `Stored classification: ${value}`} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium ${color}`}><span aria-hidden="true" className="h-1 w-1 rounded-full bg-current" />{known ? value : 'Unclassified'}</span>;
}
export function LoadState({ loading, error, reload }: { loading: boolean; error?: string; reload: () => void }) {
  if (error) return <div role="alert" className="my-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}<button type="button" onClick={reload} className="font-semibold underline">Retry</button></div>;
  if (loading) return <p role="status" className="py-10 text-sm text-slate-500">Loading records…</p>;
  return null;
}
export function Pagination({ page, total, size = 20, onChange }: { page: number; total: number; size?: number; onChange: (page: number) => void }) {
  return <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
    <span>{total} records · Page {page} of {Math.max(1, Math.ceil(total / size))}</span><div className="flex gap-3">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button>
      <button type="button" disabled={page * size >= total} onClick={() => onChange(page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button>
    </div></div>;
}

import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Send } from 'lucide-react';
import { apiFetch } from '../../api/httpClient';
import { buttonClass, complaintRequest, date, inputClass, label } from './complaintApi';
import type { Assignment, Authority, ComplaintDetail } from './complaintApi';
import { CaseKindBadge, ComplaintUpdatesLink, LoadState, StatusBadge } from './ComplaintComponents';
import { useComplaintPortal } from './useComplaintPortal';
import { useComplaintData } from './useComplaintData';

export default function ComplaintDetailPage() {
  const { id } = useParams();
  const { base, monitorBase } = useComplaintPortal();
  const state = useComplaintData<ComplaintDetail>(`/api/complaint-workflow/${id}`, true);
  const { data, token } = state;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pending = useRef<{ signature: string; body: object } | null>(null);
  const act = async (fields: Record<string, unknown>) => {
    if (!token || !data || busy) return;
    const signature = JSON.stringify({ id, fields });
    if (pending.current?.signature !== signature) pending.current = { signature, body: { ...fields,
      requestId: crypto.randomUUID(), version: data.complaint.version } };
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await complaintRequest<{ message: string }>(token, `/api/complaint-workflow/${id}/actions`, pending.current.body);
      pending.current = null; setMessage(result.message); state.reload();
    } catch (reason) {
      // A network retry reuses the original ID. A server rejection is safe to correct and resubmit.
      if (reason instanceof Error && 'status' in reason) pending.current = null;
      setError(reason instanceof Error ? reason.message : 'Unable to record this action.');
      state.reload();
    } finally { setBusy(false); }
  };
  const download = async (imageId: string, fileName: string) => {
    if (!token) return;
    try {
      const response = await apiFetch(`/api/complaint-workflow/${id}/evidence/${imageId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Unable to download evidence.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to download evidence.'); }
  };
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Link to={`${base}/complaints`} className="inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={17} />Complaints and inquiries</Link><ComplaintUpdatesLink base={base} /></div>
    <LoadState {...state} />
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
    {data && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
      <div className="space-y-6"><section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="break-all text-xs font-semibold text-indigo-700">{data.complaint.reference}</p><StatusBadge value={data.complaint.status} /></div>
        <h1 className="mt-4 text-2xl font-semibold">{data.complaint.type}</h1><div className="mt-2 flex flex-wrap items-center gap-2"><CaseKindBadge value={data.complaint.kind} /><p className="text-xs text-slate-500">Submitted {date(data.complaint.createdAtUtc)}</p></div>
        <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{data.complaint.message}</p>
        <dl className="mt-6 grid gap-5 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-slate-400">Passenger</dt><dd className="mt-1">{data.canMonitor ? <Link className="text-indigo-700 hover:underline" to={`${monitorBase}/passengers/${data.complaint.passengerId}`}>{data.complaint.passengerName}</Link> : data.complaint.passengerName}</dd>{data.complaint.contact && <dd className="mt-1 text-xs text-slate-500">{data.complaint.contact}</dd>}</div>
          <div><dt className="text-xs text-slate-400">Related trip</dt><dd className="mt-1">{data.canMonitor ? <Link className="text-indigo-700 hover:underline" to={`${monitorBase}/monitoring-trips/${data.complaint.tripId}`}>{data.complaint.boatName} · {date(data.complaint.tripDate)}</Link> : `${data.complaint.boatName} · ${date(data.complaint.tripDate)}`}</dd><dd className="mt-1 text-xs text-slate-500">{data.complaint.registrationNumber} · {data.complaint.tripStatus}</dd></div>
          <div><dt className="text-xs text-slate-400">Operator</dt><dd className="mt-1">{data.complaint.ownerName}</dd></div>
          <div><dt className="text-xs text-slate-400">Last updated (Sri Lanka time)</dt><dd className="mt-1">{date(data.complaint.updatedAtUtc)}</dd></div>
        </dl>
        <h2 className="mt-6 text-sm font-semibold">Evidence</h2><div className="mt-3 flex flex-wrap gap-3">{data.complaint.evidence.map(i => <button type="button" key={i.id} onClick={() => void download(i.id, i.fileName)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-indigo-700"><Download size={15} />{i.fileName}</button>)}{!data.complaint.evidence.length && <p className="text-xs text-slate-500">No evidence attached.</p>}</div>
      </section>
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-lg font-semibold">Handling timeline</h2><p className="mt-1 text-xs text-slate-500">Chronological history · All times in Sri Lanka time</p>
        <ol className="mt-6 space-y-6 border-l-2 border-indigo-100 pl-5">{data.timeline.map(e => <li key={e.id}><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{e.action}{e.authority ? ` · ${e.authority}` : ''}</strong><time className="text-xs text-slate-400">{date(e.createdAtUtc)}</time></div><p className="mt-1 text-xs text-slate-500">{e.actor} · {label(e.previousStatus)} → {label(e.status)}{e.assignmentStatus ? ` · Assignment: ${label(e.assignmentStatus)}` : ''}</p>{e.text && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{e.text}</p>}</li>)}</ol>
      </section></div>
      <aside className="space-y-6">
        {data.canMonitor && <MonitorActions key={data.complaint.id} detail={data} busy={busy} act={act} />}
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Authority assignments</h2>
          <p className="mt-2 text-xs text-slate-500">{data.assignments.filter(a => a.status === 'Responded').length} responded · {data.assignments.filter(a => a.status !== 'Responded').length} awaiting response</p>
          {!data.assignments.length && <p className="mt-5 text-sm text-slate-500">No authority assignments.</p>}
          <div className="mt-5 space-y-5">{data.assignments.map(a => <AssignmentCard key={a.id} assignment={a} busy={busy} closed={['Resolved', 'Closed'].includes(data.complaint.status)} act={act} />)}</div>
        </section>
      </aside>
    </div>}
  </main>;
}

function MonitorActions({ detail, busy, act }: { detail: ComplaintDetail; busy: boolean; act: (fields: Record<string, unknown>) => Promise<void> }) {
  const authorities = useComplaintData<Authority[]>('/api/complaint-workflow/authorities');
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const available = authorities.data?.filter(a => a.activeUsers > 0 && !detail.assignments.some(s => s.authorityRoleId === a.id)) ?? [];
  const recipients = available.filter(a => selected.includes(a.id));
  const canForward = !['Resolved', 'Closed'].includes(detail.complaint.status);
  return <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Review and coordinate</h2>
    {detail.allowedStatuses.length > 0 && <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void act({ action: 'status', status, text }); }}>
      <label className="block text-xs text-slate-500">Next status<select required value={status} onChange={e => setStatus(e.target.value)} className={`mt-1 ${inputClass}`}><option value="">Select next status</option>{detail.allowedStatuses.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
      <label className="block text-xs text-slate-500">Review or status-change remark<textarea required maxLength={4000} value={text} onChange={e => setText(e.target.value)} rows={3} className={`mt-1 ${inputClass}`} /></label>
      <button className={buttonClass} disabled={busy || !text.trim() || !detail.allowedStatuses.includes(status)}>Record status</button>
    </form>}
    {canForward && <form className="mt-6 space-y-3 border-t border-slate-100 pt-5" onSubmit={e => { e.preventDefault(); void act({ action: 'forward', authorityRoleIds: recipients.map(a => a.id), note }); }}>
      <h3 className="text-sm font-semibold">Forward to relevant authorities</h3><LoadState {...authorities} />
      <fieldset disabled={busy} className="space-y-2"><legend className="sr-only">Select receiving authorities</legend>{available.map(a => <label key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 text-sm"><input type="checkbox" checked={selected.includes(a.id)} onChange={e => setSelected(s => e.target.checked ? [...s, a.id] : s.filter(id => id !== a.id))} /><span>{a.name}<span className="ml-2 text-xs text-slate-400">{a.activeUsers} active users</span></span></label>)}</fieldset>
      {!available.length && !authorities.loading && <p className="text-xs text-slate-500">No additional active authorities are available.</p>}
      <label className="block text-xs text-slate-500">Forwarding note (optional)<textarea maxLength={2000} value={note} onChange={e => setNote(e.target.value)} rows={3} className={`mt-1 ${inputClass}`} /></label>
      {recipients.length > 0 && <div className="rounded-xl bg-indigo-50 p-3 text-xs leading-6 text-indigo-800"><p className="break-all">Confirm referral: {detail.complaint.reference}</p><p>Receiving authorities: {recipients.map(a => a.name).join(', ')}</p></div>}
      <button className={buttonClass} disabled={busy || !recipients.length}><Send size={15} />Confirm forwarding</button>
    </form>}
  </section>;
}

function AssignmentCard({ assignment: a, closed, busy, act }: { assignment: Assignment; closed: boolean; busy: boolean; act: (fields: Record<string, unknown>) => Promise<void> }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('Responded');
  return <article id={`assignment-${a.id}`} className="scroll-mt-24 rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{a.authority}</strong><StatusBadge value={a.status} /></div>
    <p className="mt-2 text-xs leading-5 text-slate-500">Forwarded by {a.forwardedBy}<br />{date(a.forwardedAtUtc)}</p>{a.note && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{a.note}</p>}
    <p className="mt-3 text-xs leading-6 text-slate-500">Acknowledged: {date(a.acknowledgedAtUtc)}<br />Last response: {date(a.respondedAtUtc)}<br />Updated: {date(a.updatedAtUtc)}</p>
    {a.canRespond && !closed && (a.status === 'Pending' ? <button className={`mt-4 ${buttonClass}`} disabled={busy} onClick={() => void act({ action: 'assignment', assignmentId: a.id, status: 'Acknowledged' })}>Acknowledge receipt</button> :
      <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void act({ action: 'assignment', assignmentId: a.id, status, text }); }}>
        <label className="block text-xs text-slate-500">Assignment status<select className={`mt-1 ${inputClass}`} value={status} onChange={e => setStatus(e.target.value)}><option value="Responded">Official response</option><option value="InProgress">In progress / follow-up remark</option></select></label>
        <label className="block text-xs text-slate-500">Response or progress remark<textarea required maxLength={4000} rows={4} value={text} onChange={e => setText(e.target.value)} className={`mt-1 ${inputClass}`} /></label>
        <p className="text-xs leading-5 text-slate-400">Every update is retained in the handling timeline.</p><button disabled={busy || !text.trim()} className={buttonClass}>Record authority update</button>
      </form>)}
  </article>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Search, X } from 'lucide-react';
import { shoreAttendanceApi, type AttendanceManifest, type AttendanceStatus, type PassengerGroup, type PassengerGroupSearch } from './shoreAttendanceApi';
import PassengerQrScanner from './components/PassengerQrScanner';
import ShoreDialog from './components/ShoreDialog';

export default function PassengerAttendancePanel({ token, tripId }: { token: string; tripId: string }) {
  const [manifest, setManifest] = useState<AttendanceManifest>();
  const [group, setGroup] = useState<PassengerGroup>();
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PassengerGroupSearch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [scanner, setScanner] = useState(false);
  const [review, setReview] = useState(false);
  const [finalize, setFinalize] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);

  const load = useCallback(async () => {
    const data = await shoreAttendanceApi.manifest(token, tripId);
    if (mounted.current) setManifest(data);
  }, [token, tripId]);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void shoreAttendanceApi.manifest(token, tripId).then(data => { if (active) setManifest(data); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load attendance.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; };
  }, [token, tripId]);
  useEffect(() => {
    let active = true;
    const term = query.trim();
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setResults([]); setSearchError('');
      if (term.length < 2) { setSearching(false); return; }
      setSearching(true);
      void shoreAttendanceApi.search(token, tripId, term, controller.signal).then(items => { if (active) setResults(items); })
        .catch(reason => { if (active) setSearchError(reason instanceof Error ? reason.message : 'Passenger search failed.'); })
        .finally(() => { if (active) setSearching(false); });
    }, 300);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [query, token, tripId, searchAttempt]);

  const openGroup = (value: PassengerGroup) => {
    if (value.tripId !== tripId) throw new Error('This passenger group does not belong to the selected trip.');
    if (!mounted.current) return;
    setGroup(value); setStatuses(Object.fromEntries(value.members.map(member => [member.passengerId, member.status])));
    setResults([]); setQuery(''); setError('');
  };
  const scan = async (value: string) => {
    if (pending.current) throw new Error('A passenger request is already being processed. Please wait.');
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const data = await shoreAttendanceApi.scan(token, tripId, value);
      if (!mounted.current) return;
      openGroup(data); setScanner(false);
      setMessage(data.alreadyProcessed ? 'This passenger group has already been checked. Existing attendance is shown.' : 'QR validated. Review the passenger group before confirming attendance.');
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const openSearch = async (id: string) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const data = await shoreAttendanceApi.group(token, tripId, id);
      if (!mounted.current) return;
      openGroup(data); setMessage(data.alreadyProcessed ? 'This passenger group has already been checked. Existing attendance is shown.' : 'Passenger group loaded. Review attendance before saving.');
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Unable to open passenger group.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const save = async () => {
    if (!group || pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const updated = await shoreAttendanceApi.saveGroup(token, tripId, group.primaryPassengerId,
        group.members.map(member => ({ passengerId: member.passengerId, status: statuses[member.passengerId] ?? 'NotChecked' })));
      if (!mounted.current) return;
      openGroup(updated); setReview(false); setMessage('Passenger attendance saved successfully.');
      await load();
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Unable to save attendance.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const finalizeManifest = async () => {
    if (!manifest || pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const updated = await shoreAttendanceApi.finalize(token, tripId, manifest.summary.notChecked > 0);
      if (mounted.current) { setManifest(updated); setFinalize(false); setGroup(undefined); setMessage('Passenger verification finalized successfully.'); }
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Unable to finalize attendance.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const summary = manifest?.summary ?? { present: 0, notPresent: 0, notChecked: 0, total: 0 };
  const selected = Object.values(statuses);
  const groupPresent = selected.filter(x => x === 'Present').length;
  const groupAbsent = selected.filter(x => x === 'NotPresent').length;
  const groupUnchecked = selected.filter(x => x === 'NotChecked').length;
  const percent = summary.total ? Math.round(summary.present / summary.total * 100) : 0;
  const dirty = group?.members.some(member => statuses[member.passengerId] !== member.status) ?? false;
  const locked = Boolean(manifest?.finalizedAtUtc) || !['Scheduled', 'Boarding', 'NeedsReschedule'].includes(manifest?.tripStatus ?? '');
  return <section className="min-w-0 space-y-5" aria-label="Passenger attendance">
    {loading && <p role="status" className="rounded-xl bg-white p-5 text-sm">Loading passenger attendance…</p>}
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button type="button" disabled={busy} className="min-h-11 font-semibold underline" onClick={() => { void load().then(() => setError('')).catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to load attendance.')); }}>Refresh attendance</button></div>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {busy && !scanner && <p role="status" className="text-sm text-slate-500">Processing passenger request…</p>}
    <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-[#14223d]">Passenger Attendance</h2><p className="mt-1 text-sm font-semibold text-indigo-700">{summary.present} of {summary.total} passengers are Present</p></div>{manifest?.finalizedAtUtc && <span className="break-words rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Finalized by {manifest.finalizedBy}</span>}</div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} /></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Present Today" value={summary.present} color="text-emerald-600" /><Metric label="Not Present" value={summary.notPresent} color="text-red-600" /><Metric label="Not Yet Checked" value={summary.notChecked} color="text-slate-500" /><Metric label="Total Registered" value={summary.total} color="text-[#14223d]" /></div></section>
    <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#14223d]">Passenger Check-In</h2><p className="mt-1 text-xs leading-5 text-slate-500">Scan the primary passenger’s personal QR to retrieve their registered group.</p></div><button type="button" disabled={busy || locked || loading} onClick={() => setScanner(true)} className="flex min-h-11 items-center gap-2 rounded-lg bg-[#14223d] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"><Camera size={18} />Scan Passenger QR</button></div>
      <div className="relative mt-5"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input ref={searchInput} aria-label="Search registered passengers" value={query} maxLength={100} onChange={event => { setQuery(event.target.value); setResults([]); }} placeholder="Name, reference, or registration ID" className="h-11 w-full min-w-0 rounded-lg border border-slate-200 pl-10 pr-3 text-base outline-none focus:border-indigo-400 sm:text-sm" /></div>
      {searching && <p role="status" className="mt-3 text-xs text-slate-500">Searching registered passengers…</p>}
      {searchError && <p role="alert" className="mt-3 text-sm text-red-700">{searchError}<button type="button" className="ml-2 min-h-11 underline" onClick={() => setSearchAttempt(value => value + 1)}>Retry search</button></p>}
      {query.trim().length >= 2 && !searching && !searchError && !results.length && <p className="mt-3 text-xs text-slate-500">No matching registered passengers.</p>}
      {results.length > 0 && <div className="mt-2 overflow-hidden rounded-lg border">{results.map(item => <button type="button" key={item.primaryPassengerId} disabled={busy} onClick={() => { void openSearch(item.primaryPassengerId); }} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 border-t p-3 text-left text-xs first:border-0 hover:bg-slate-50 disabled:opacity-40"><span className="min-w-0 break-words"><b className="block text-sm">{item.primaryPassengerName}</b>{item.passengerReference}</span><span>{item.memberCount} passengers · {item.alreadyProcessed ? 'Checked' : 'Not checked'}</span></button>)}</div>}
    </section>
    {group && <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="break-words text-lg font-semibold text-[#14223d]">{group.primaryPassengerName}’s Group</h2><p className="mt-1 break-words text-xs leading-5 text-slate-500">Primary reference: {group.primaryPassengerReference} · Trip {group.tripId}</p><p className="mt-1 text-xs text-slate-500">{group.boatName} · {group.registrationNumber} · {new Date(group.scheduledDepartureUtc).toLocaleString()}</p>{group.alreadyProcessed && <p className="mt-2 text-xs font-semibold text-indigo-700">This passenger group has already been checked. Existing statuses are shown below.</p>}</div><button type="button" disabled={busy} aria-label="Close passenger group" onClick={() => setGroup(undefined)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-50"><X /></button></div>
      <div className="mt-5 space-y-3">{group.members.map(member => <article key={member.passengerId} className="grid min-w-0 gap-3 rounded-lg border p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><p className="break-words font-semibold text-[#14223d]">{member.name}</p><p className="mt-1 break-words text-xs leading-5 text-slate-500">{member.relationship} · {member.passengerReference} · {member.phoneNumber}</p><StatusBadge status={statuses[member.passengerId] ?? member.status} /></div><div className="flex flex-wrap items-center gap-2">{(['Present', 'NotPresent', 'NotChecked'] as const).map(status => <StatusButton key={status} label={statusLabel(status)} active={statuses[member.passengerId] === status} disabled={busy || group.finalized || locked} color={status === 'Present' ? 'bg-emerald-500' : status === 'NotPresent' ? 'bg-red-500' : 'bg-slate-500'} onClick={() => setStatuses(current => ({ ...current, [member.passengerId]: status }))} />)}</div></article>)}</div>
      {!group.finalized && !locked && <button type="button" disabled={busy || !dirty} onClick={() => setReview(true)} className="mt-5 min-h-11 w-full rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Confirm Attendance</button>}
    </section>}
    <section className="min-w-0 overflow-hidden rounded-xl bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-5 sm:px-6"><h2 className="text-lg font-semibold text-[#14223d]">Passenger Manifest</h2><button type="button" disabled={busy || locked || summary.total === 0} onClick={() => setFinalize(true)} className="min-h-11 rounded-lg border border-indigo-600 px-4 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-40">Complete Passenger Verification</button></div>
      <div className="overflow-x-auto" role="region" aria-label="Passenger manifest table" tabIndex={0}><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['Passenger', 'Reference', 'Group / Relationship', 'Status', 'Check-in Time'].map(label => <th key={label} className="px-5 py-3">{label}</th>)}</tr></thead><tbody className="divide-y">{manifest?.passengers.map(person => <tr key={person.passengerId}><td className="px-5 py-4 font-semibold">{person.name}</td><td className="px-5 py-4">{person.passengerReference}</td><td className="px-5 py-4">{person.relationship}</td><td className="px-5 py-4"><StatusBadge status={person.status} /></td><td className="px-5 py-4">{person.checkedAtUtc ? new Date(person.checkedAtUtc).toLocaleString() : '–'}</td></tr>)}</tbody></table>{summary.total === 0 && <p className="p-6 text-center text-xs text-slate-400">No passengers registered for this trip.</p>}</div>
    </section>
    {scanner && <PassengerQrScanner onScan={scan} onClose={() => setScanner(false)} onSearch={() => { setScanner(false); window.setTimeout(() => searchInput.current?.focus(), 0); }} />}
    {review && <ConfirmDialog title="Confirm Group Attendance" text={`${groupPresent} passengers marked Present · ${groupAbsent} marked Not Present.`} warning={groupUnchecked ? `${groupUnchecked} passengers remain Not Yet Checked. Are you sure you want to continue?` : undefined} busy={busy} onBack={() => setReview(false)} onConfirm={() => { void save(); }} />}
    {finalize && <ConfirmDialog title="Complete Passenger Verification" text={`${summary.present} Present · ${summary.notPresent} Not Present · ${summary.notChecked} Not Yet Checked · ${summary.total} Total`} warning={summary.notChecked ? `${summary.notChecked} passengers have not been checked. Finalize anyway?` : 'The manifest will be locked after finalization.'} busy={busy} onBack={() => setFinalize(false)} onConfirm={() => { void finalizeManifest(); }} />}
  </section>;
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) { return <div className="min-w-0 rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>; }
const statusLabel = (status: AttendanceStatus) => status === 'NotPresent' ? 'Not Present' : status === 'NotChecked' ? 'Not Yet Checked' : 'Present';
function StatusBadge({ status }: { status: AttendanceStatus }) { return <span className={`mt-2 inline-block rounded-full px-3 py-1 text-[10px] font-semibold ${status === 'Present' ? 'bg-emerald-50 text-emerald-700' : status === 'NotPresent' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{statusLabel(status)}</span>; }
function StatusButton({ label, active, disabled, color, onClick }: { label: string; active: boolean; disabled: boolean; color: string; onClick: () => void }) { return <button type="button" disabled={disabled} aria-pressed={active} onClick={onClick} className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold ${active ? `${color} border-transparent text-white` : 'border-slate-200 bg-white text-slate-600'} disabled:opacity-50`}>{label}</button>; }
function ConfirmDialog({ title, text, warning, busy, onBack, onConfirm }: { title: string; text: string; warning?: string; busy: boolean; onBack: () => void; onConfirm: () => void }) {
  return <ShoreDialog title={title} onClose={onBack} busy={busy}><p className="text-sm text-slate-600">{text}</p>{warning && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{warning}</p>}<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={onBack} className="min-h-11 rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Go Back</button><button type="button" disabled={busy} onClick={onConfirm} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Confirm & Save'}</button></div></ShoreDialog>;
}

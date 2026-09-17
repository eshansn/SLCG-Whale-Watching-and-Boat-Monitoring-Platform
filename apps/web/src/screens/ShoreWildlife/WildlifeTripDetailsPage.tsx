import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, Search, UserRound } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import SignaturePad from '../../components/SignaturePad';
import {
  wildlifeApi,
  watchAttendance,
  type Attendance,
  type MonitoringRecord,
  type RecordSignatureRequest,
  type SignatureType,
  type SignatureUser,
} from './shoreWildlifeApi';

const formatDate = (value: string) => new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));

export default function WildlifeTripDetailsPage() {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState<Attendance>();
  const [record, setRecord] = useState<MonitoringRecord>();
  const [form, setForm] = useState({ ticketNumber: '', tidNumber: '', monitoringOfficer: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [nextAttendance, records] = await Promise.all([
        wildlifeApi.attendance(session.accessToken, id),
        wildlifeApi.records(session.accessToken),
      ]);
      const nextRecord = records.find((item) => item.tripId === id);
      setAttendance(nextAttendance);
      setRecord(nextRecord);
      if (nextRecord) setForm({
        ticketNumber: nextRecord.ticketNumber,
        tidNumber: nextRecord.tidNumber,
        monitoringOfficer: nextRecord.monitoringOfficer,
      });
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load Passenger Attendance.');
    } finally {
      setLoading(false);
    }
  }, [id, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    if (!session) return;
    const disconnect = watchAttendance(session.accessToken, () => void load());
    return () => { window.clearTimeout(timer); disconnect(); };
  }, [load, session]);

  const saveDetails = async () => {
    if (!session || busy || Object.values(form).some((value) => !value.trim())) return;
    setBusy(true);
    setError('');
    try {
      const nextRecord = record
        ? await wildlifeApi.requestSignature(session.accessToken, record.id, form)
        : await wildlifeApi.create(session.accessToken, { tripId: id, ...form });
      setRecord(nextRecord);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save monitoring information.');
    } finally {
      setBusy(false);
    }
  };

  const finalize = async (action: 'confirm' | 'discard') => {
    if (!session || !record || busy) return;
    setBusy(true);
    setError('');
    try {
      setRecord(action === 'confirm'
        ? await wildlifeApi.confirm(session.accessToken, record.id)
        : await wildlifeApi.discard(session.accessToken, record.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update the monitoring record.');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !attendance) return <Page title="Trip monitoring" subtitle="Loading Passenger Attendance..." />;
  if (!attendance) return <Page title="Trip monitoring" subtitle="Attendance unavailable"><ErrorNotice message={error} retry={() => void load()} /></Page>;
  const closed = record?.status === 'Completed' || record?.status === 'Discarded';
  const allSigned = Boolean(record?.monitoringOfficerSignature && (record.usesSignatureRequestWorkflow
    ? record.supervisorRequest?.status === 'Signed' && record.harbourOfficerRequest?.status === 'Signed'
    : record.supervisorSignature && record.harbourOfficerSignature && record.harbourOfficerName));
  const detailsLocked = closed || Boolean(record?.monitoringOfficerSignature ||
    record?.supervisorRequest?.status === 'Signed' || record?.harbourOfficerRequest?.status === 'Signed');

  return (
    <Page title={attendance.boatName} subtitle={`${attendance.registrationNumber} · ${formatDate(attendance.scheduledDepartureUtc)}`}>
      <button type="button" onClick={() => navigate('/shore-wildlife')} className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700">
        <ChevronLeft size={18} /> Trips
      </button>
      {error && <ErrorNotice message={error} retry={() => void load()} />}
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[1fr_.95fr]">
        <div className="space-y-6">
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Trip Information</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <Info label="Trip reference" value={attendance.tripId} />
              <Info label="Boat operator" value={attendance.ownerName} />
              <Info label="Route" value={attendance.route} />
              <Info label="Status" value={attendance.tripStatus} />
            </dl>
          </section>
          <AttendanceBreakdown attendance={attendance} />
        </div>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Monitoring Information</h2>
          <div className="mt-5 grid gap-4">
            {([
              ['ticketNumber', 'Ticket Number', 80],
              ['tidNumber', 'TID Number', 80],
              ['monitoringOfficer', 'Monitoring Officer Name', 160],
            ] as const).map(([key, label, maxLength]) => (
              <label key={key} className="text-sm font-medium">{label}
                <input value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                  required maxLength={maxLength} disabled={detailsLocked || busy}
                  className="mt-1 block h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-indigo-400 disabled:bg-slate-50" />
              </label>
            ))}
          </div>
          {!record && <button type="button" onClick={() => void saveDetails()} disabled={busy || Object.values(form).some((value) => !value.trim())}
            className="mt-6 w-full rounded-lg bg-[#14223d] px-4 py-3 font-semibold text-white disabled:opacity-40">
            {busy ? 'Saving...' : 'Continue to Signatures'}
          </button>}
          {record && !detailsLocked && <button type="button" onClick={() => void saveDetails()} disabled={busy || Object.values(form).some((value) => !value.trim())}
            className="mt-5 text-sm font-semibold text-indigo-700 disabled:opacity-40">Save monitoring details</button>}

          {record?.usesSignatureRequestWorkflow && !closed && session && (
            <SignatureWorkflow record={record} token={session.accessToken} onChanged={(next) => setRecord(next)} reload={load} />
          )}
          {record && !record.usesSignatureRequestWorkflow && <LegacySignatureSummary record={record} />}

          {record && !closed && (
            <div className="mt-7 border-t pt-5">
              {!allSigned && <p className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-800">Waiting for required signatures</p>}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <SignatureStatus label="Monitoring Officer" status={record.monitoringOfficerSignature ? 'Signed' : 'Not Requested'} />
                <SignatureStatus label="Supervisor" status={record.supervisorRequest?.status ?? 'Not Requested'} />
                <SignatureStatus label="Harbour Officer" status={record.harbourOfficerRequest?.status ?? 'Not Requested'} />
              </div>
              <div className="mt-5 flex gap-3">
                <button type="button" disabled={busy} onClick={() => void finalize('discard')} className="flex-1 rounded-lg border border-red-300 py-2.5 font-semibold text-red-700 disabled:opacity-40">Discard</button>
                <button type="button" disabled={busy || !allSigned} onClick={() => void finalize('confirm')} className="flex-1 rounded-lg bg-emerald-600 py-2.5 font-semibold text-white disabled:opacity-40">Confirm</button>
              </div>
            </div>
          )}
          {record?.status === 'Completed' && <p className="mt-6 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">Monitoring record confirmed.</p>}
          {record?.status === 'Discarded' && <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">Monitoring record discarded.</p>}
        </section>
      </div>
    </Page>
  );
}

function SignatureWorkflow({ record, token, onChanged, reload }: { record: MonitoringRecord; token: string; onChanged: (record: MonitoringRecord) => void; reload: () => Promise<void> }) {
  const [monitoringSignature, setMonitoringSignature] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const saveMonitoring = async () => {
    if (!monitoringSignature || saving) return;
    setSaving(true); setError('');
    try { onChanged(await wildlifeApi.sign(token, record.id, { monitoringOfficerSignature: monitoringSignature })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save Monitoring Officer signature.'); }
    finally { setSaving(false); }
  };
  return <div className="mt-7 space-y-6 border-t pt-6">
    <h3 className="font-semibold">Required Signatures</h3>
    {record.monitoringOfficerSignature ? <SignedSignature title="Monitoring Officer" name={record.monitoringOfficer} signature={record.monitoringOfficerSignature} signedAt={record.monitoringOfficerSignedAtUtc} /> : <div>
      <SignaturePad label={`Monitoring Officer — ${record.monitoringOfficer}`} onChange={setMonitoringSignature} disabled={saving} />
      <button type="button" disabled={saving || !monitoringSignature} onClick={() => void saveMonitoring()} className="mt-2 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving ? 'Saving...' : 'Save Monitoring Officer Signature'}</button>
    </div>}
    <SignerRequestSection recordId={record.id} token={token} type="Supervisor" current={record.supervisorRequest} reload={reload} />
    <SignerRequestSection recordId={record.id} token={token} type="HarbourOfficer" current={record.harbourOfficerRequest} reload={reload} />
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>;
}

function SignerRequestSection({ recordId, token, type, current, reload }: { recordId: string; token: string; type: SignatureType; current?: RecordSignatureRequest; reload: () => Promise<void> }) {
  const label = type === 'Supervisor' ? 'Supervisor' : 'Harbour Officer';
  const [editing, setEditing] = useState(!current || current.status === 'Declined');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SignatureUser[]>([]);
  const [selected, setSelected] = useState<SignatureUser>();
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void wildlifeApi.searchSignatureUsers(token, type, term).then((items) => {
        if (!active) return;
        setResults(items); setActiveIndex(0); setError('');
      }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Search failed.'); })
        .finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, token, type]);

  const requestSignature = async () => {
    if (!selected || requesting) return;
    setRequesting(true); setError('');
    try {
      await wildlifeApi.requestExternalSignature(token, recordId, type, selected.id);
      setEditing(false); setQuery(''); setSelected(undefined); setResults([]);
      await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to request signature.'); }
    finally { setRequesting(false); }
  };

  if (current?.status === 'Signed') return <SignedSignature title={label} name={current.requestedUserFullName} signature={current.signatureData} signedAt={current.signedAtUtc} />;
  return <section className="rounded-xl border border-slate-200 p-4">
    <div className="flex items-start justify-between gap-3">
      <div><h4 className="font-semibold">{label} Signature</h4>
        {current && <p className="mt-1 text-xs text-slate-500">{current.requestedUserFullName} · {current.requestedUserEmail}</p>}
      </div>
      <StatusBadge status={current?.status ?? 'Not Requested'} />
    </div>
    {current?.status === 'Pending' && !editing && <button type="button" onClick={() => setEditing(true)} className="mt-3 text-xs font-semibold text-indigo-700">Change requested {label}</button>}
    {current?.status === 'Declined' && current.declineReason && <p className="mt-3 rounded bg-red-50 p-2 text-xs text-red-700">Declined: {current.declineReason}</p>}
    {current?.status === 'Declined' && !editing && <button type="button" onClick={() => setEditing(true)} className="mt-3 text-xs font-semibold text-indigo-700">Request another {label}</button>}
    {editing && <div className="mt-4">
      <label className="text-xs font-semibold text-slate-700">Search {label} by name, username, or email
        <div className="relative mt-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(undefined); setResults([]); setLoading(false); }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, results.length - 1)); }
              if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
              if (event.key === 'Enter' && results[activeIndex]) { event.preventDefault(); setSelected(results[activeIndex]); setQuery(results[activeIndex].fullName); setResults([]); }
              if (event.key === 'Escape') setResults([]);
            }}
            placeholder={`Search ${label}`} className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-indigo-400" />
        </div>
      </label>
      {loading && <p className="mt-2 text-xs text-slate-400">Searching...</p>}
      {!loading && query.trim().length >= 2 && !results.length && !selected && !error && <p className="mt-2 text-xs text-slate-400">No matching users</p>}
      {results.length > 0 && <div role="listbox" className="mt-1 overflow-hidden rounded-lg border bg-white shadow-lg">
        {results.map((user, index) => <button key={user.id} type="button" role="option" aria-selected={index === activeIndex}
          onMouseEnter={() => setActiveIndex(index)} onClick={() => { setSelected(user); setQuery(user.fullName); setResults([]); }}
          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${index === activeIndex ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
          <UserRound size={18} className="text-indigo-700" /><span><b className="block text-sm">{user.fullName}</b><span className="text-xs text-slate-500">{user.username} · {user.email}</span></span>
        </button>)}
      </div>}
      {selected && <div className="mt-3 flex items-center justify-between rounded-lg bg-indigo-50 p-3"><div><p className="text-xs font-semibold uppercase text-indigo-700">Selected {label}</p><p className="mt-1 text-sm font-semibold">{selected.fullName}</p><p className="text-xs text-slate-500">{selected.email}</p></div><Check className="text-emerald-600" /></div>}
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        {current && <button type="button" onClick={() => { setEditing(false); setError(''); }} className="rounded-lg border px-3 py-2 text-xs font-semibold">Cancel</button>}
        <button type="button" disabled={!selected || requesting} onClick={() => void requestSignature()} className="rounded-lg bg-[#14223d] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{requesting ? 'Requesting...' : 'Request Signature'}</button>
      </div>
    </div>}
  </section>;
}

function SignedSignature({ title, name, signature, signedAt }: { title: string; name: string; signature?: string; signedAt?: string }) {
  return <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"><div className="flex justify-between gap-3"><div><h4 className="font-semibold">{title} Signature</h4><p className="mt-1 text-sm">{name}</p></div><StatusBadge status="Signed" /></div>{signature && <img src={signature} alt={`${title} signature`} className="mt-3 h-20 w-full rounded-lg bg-white object-contain" />}{signedAt && <p className="mt-2 text-xs text-slate-500">Signed at: {formatDate(signedAt)}</p>}</section>;
}
function LegacySignatureSummary({ record }: { record: MonitoringRecord }) { return <div className="mt-7 border-t pt-5"><p className="text-sm font-semibold">Legacy signatures</p><p className="mt-1 text-xs text-slate-500">This historical record retains its original manually captured signatures.</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{[['Monitoring Officer', record.monitoringOfficerSignature], ['Supervisor', record.supervisorSignature], ['Harbour Officer', record.harbourOfficerSignature]].map(([label, signature]) => <div key={label} className="rounded-lg border p-3"><p className="text-xs font-semibold">{label}</p>{signature ? <img src={signature} alt={`${label} signature`} className="mt-2 h-16 w-full object-contain" /> : <p className="mt-2 text-xs text-slate-400">Not signed</p>}</div>)}</div></div>; }
function SignatureStatus({ label, status }: { label: string; status: string }) { return <div className="rounded-lg bg-slate-50 p-2"><p className="font-semibold">{label}</p><p className={status === 'Signed' ? 'mt-1 text-emerald-700' : status === 'Declined' ? 'mt-1 text-red-700' : 'mt-1 text-amber-700'}>{status}</p></div>; }
function StatusBadge({ status }: { status: string }) { const tone = status === 'Signed' ? 'bg-emerald-100 text-emerald-700' : status === 'Declined' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'; return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>; }
function AttendanceBreakdown({ attendance }: { attendance: Attendance }) { return <section className="rounded-xl bg-white p-6 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">Passenger Attendance</h2><p className="mt-1 text-sm font-semibold text-emerald-600">Live Attendance</p></div><p className="text-xs text-slate-500">Last updated: {formatDate(attendance.lastUpdatedUtc)}</p></div><div className="mt-6 grid gap-4 md:grid-cols-2"><AttendanceGroup name="LOCAL" count={attendance.local} /><AttendanceGroup name="FOREIGN" count={attendance.foreign} /></div><div className="mt-5 rounded-xl bg-[#14223d] p-5 text-white"><p className="text-xs uppercase">Total present</p><p className="text-4xl font-bold">{attendance.totalPresent}</p></div></section>; }
function AttendanceGroup({ name, count }: { name: string; count: Attendance['local'] }) { return <div className="rounded-xl border p-5"><h3 className="font-semibold">{name}</h3>{[['Adult', count.adult], ['Child', count.child], ['Small (Under 6 Y)', count.small]].map(([label, value]) => <div key={String(label)} className="mt-3 flex justify-between text-sm"><span>{label}</span><b>{value}</b></div>)}<div className="mt-4 flex justify-between border-t pt-3 font-semibold"><span>Total</span><b>{count.total}</b></div></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs uppercase text-slate-400">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>; }
function ErrorNotice({ message, retry }: { message: string; retry: () => void }) { return <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-700"><span>{message}</span><button type="button" onClick={retry} className="shrink-0 font-semibold underline">Retry</button></div>; }
function Page({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) { return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><h1 className="text-3xl font-semibold text-[#14223d]">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p><div className="mt-7">{children}</div></main>; }

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileSignature, LogOut, X } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import SignaturePad from '../../components/SignaturePad';
import { signatureRequestsApi, watchSignatureRequests, type SignatureRequestDetails } from './signatureRequestsApi';

const formatDate = (value: string) => new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

export default function SignaturePortalPage({ portalRole }: { portalRole: 'Supervisor' | 'HarbourOfficer' }) {
  const { session, logout } = useAuth();
  const [requests, setRequests] = useState<SignatureRequestDetails[]>([]);
  const [selected, setSelected] = useState<SignatureRequestDetails>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const label = portalRole === 'Supervisor' ? 'Supervisor' : 'Harbour Officer';

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setRequests(await signatureRequestsApi.list(session.accessToken));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load signature requests.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    if (!session) return;
    const disconnect = watchSignatureRequests(session.accessToken, () => void load());
    const interval = window.setInterval(() => void load(), 15000);
    return () => {
      window.clearTimeout(initialLoad);
      disconnect();
      window.clearInterval(interval);
    };
  }, [load, session]);

  const relevant = useMemo(
    () => requests.filter((item) => item.signatureType === portalRole),
    [portalRole, requests],
  );
  const pending = relevant.filter((item) => item.status === 'Pending');
  const issued = relevant.filter((item) => item.status === 'Signed');

  return (
    <div className="signature-portal min-h-screen min-w-0 overflow-x-hidden bg-[#f8f9fb] font-[Poppins] text-[#14223d]">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-2 px-4 py-2 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/WildlifeAuthority.png"
              alt="Department of Wildlife Conservation"
              className="h-9 w-auto shrink-0 sm:h-10"
            />
            <div className="hidden min-w-0 border-l pl-3 sm:block">
              <p className="text-xs text-slate-400">WWMS</p>
              <p className="truncate text-sm font-semibold">{label} Portal</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <p className="hidden min-w-0 text-right text-xs sm:block">
              <span className="block font-semibold">{label}</span>
              <span className="block max-w-56 truncate text-slate-400">{session?.email}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                logout();
                window.location.assign('/login');
              }}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#14223d] px-3 text-sm font-semibold text-white sm:px-4"
            >
              <LogOut size={17} aria-hidden="true" />
              <span className="hidden min-[360px]:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-2xl font-semibold sm:text-3xl">Signature Requests</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
          Review and sign Passenger Attendance records assigned to you.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 flex flex-col items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"
          >
            <span className="break-words">{error}</span>
            <button type="button" onClick={() => void load()} className="min-h-11 shrink-0 font-semibold underline">
              Retry
            </button>
          </div>
        )}

        <section className="mt-6 grid gap-4 md:mt-7 md:grid-cols-2">
          {pending.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              actionLabel="View & Sign"
              onOpen={() => setSelected(request)}
            />
          ))}
        </section>

        {loading && !requests.length && (
          <p className="mt-6 rounded-xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm sm:p-8">
            Loading requests...
          </p>
        )}
        {!loading && !pending.length && (
          <p className="mt-6 rounded-xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm sm:p-8">
            No pending signature requests.
          </p>
        )}

        <section className="mt-10 sm:mt-12">
          <h2 className="text-xl font-semibold sm:text-2xl">Issued Signatures</h2>
          <p className="mt-1 text-sm text-slate-500">Your completed signature history.</p>

          <div className="mt-5 overflow-hidden rounded-xl bg-white shadow-sm">
            {issued.length ? (
              <>
                <div className="divide-y md:hidden">
                  {issued.map((request) => (
                    <IssuedSignatureCard key={request.id} request={request} onOpen={() => setSelected(request)} />
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-5 py-4">Attendance</th>
                        <th className="px-3 py-4">Boat</th>
                        <th className="px-3 py-4">Trip date</th>
                        <th className="px-3 py-4">Requested by</th>
                        <th className="px-3 py-4">Signed</th>
                        <th className="px-5 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {issued.map((request) => (
                        <tr key={request.id}>
                          <td className="px-5 py-4 font-semibold">{request.attendanceReference}</td>
                          <td className="px-3 py-4">
                            {request.boatName}
                            <span className="block text-xs text-slate-400">{request.registrationNumber}</span>
                          </td>
                          <td className="px-3 py-4">{formatDate(request.tripDateUtc)}</td>
                          <td className="px-3 py-4">{request.requestedByName}</td>
                          <td className="px-3 py-4">{request.signedAtUtc ? formatDate(request.signedAtUtc) : '—'}</td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelected(request)}
                              className="min-h-11 px-2 font-semibold text-indigo-700"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="p-6 text-center text-sm text-slate-400 sm:p-8">No signatures have been issued.</p>
            )}
          </div>
        </section>
      </main>

      {selected && session && (
        <SignatureRequestDialog
          request={selected}
          token={session.accessToken}
          onClose={() => setSelected(undefined)}
          onChanged={async () => {
            setSelected(undefined);
            await load();
          }}
        />
      )}
    </div>
  );
}

function RequestCard({ request, actionLabel, onOpen }: {
  request: SignatureRequestDetails;
  actionLabel: string;
  onOpen: () => void;
}) {
  return (
    <article className="min-w-0 rounded-xl bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-lg bg-amber-50 p-2.5 text-amber-700">
            <FileSignature size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="break-words font-semibold">{request.attendanceReference}</h2>
            <p className="text-xs text-slate-500">Passenger Attendance</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
          Pending
        </span>
      </div>
      <dl className="mt-5 grid grid-cols-1 gap-4 text-xs min-[420px]:grid-cols-2">
        <Detail label="Boat" value={`${request.boatName} · ${request.registrationNumber}`} />
        <Detail label="Trip date" value={formatDate(request.tripDateUtc)} />
        <Detail label="Monitoring Officer" value={request.monitoringOfficer} />
        <Detail label="Requested" value={formatDate(request.requestedAtUtc)} />
      </dl>
      <button
        type="button"
        onClick={onOpen}
        className="mt-5 min-h-11 w-full rounded-lg bg-[#14223d] px-4 py-2.5 text-sm font-semibold text-white"
      >
        {actionLabel}
      </button>
    </article>
  );
}

function IssuedSignatureCard({ request, onOpen }: { request: SignatureRequestDetails; onOpen: () => void }) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-semibold">{request.attendanceReference}</h3>
          <p className="mt-1 break-words text-xs text-slate-500">
            {request.boatName} · {request.registrationNumber}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="min-h-11 shrink-0 rounded-lg border border-indigo-200 px-3 text-sm font-semibold text-indigo-700"
        >
          View
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-xs min-[420px]:grid-cols-2">
        <Detail label="Trip date" value={formatDate(request.tripDateUtc)} />
        <Detail label="Requested by" value={request.requestedByName} />
        <Detail label="Signed" value={request.signedAtUtc ? formatDate(request.signedAtUtc) : '—'} />
      </dl>
    </article>
  );
}

function SignatureRequestDialog({ request, token, onClose, onChanged }: {
  request: SignatureRequestDetails;
  token: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [signature, setSignature] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [busy, onClose]);

  const sign = async () => {
    if (!signature || busy || !window.confirm('You are about to sign this Passenger Attendance record.')) return;
    setBusy(true);
    setError('');
    try {
      await signatureRequestsApi.sign(token, request.id, signature);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign request.');
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await signatureRequestsApi.decline(token, request.id, declineReason.trim() || undefined);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to decline request.');
    } finally {
      setBusy(false);
    }
  };

  const readOnly = request.status !== 'Pending';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/50 sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-dialog-title"
        className="max-h-[100dvh] w-full min-w-0 overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:my-8 sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="signature-dialog-title" className="break-words text-lg font-semibold sm:text-xl">
              Passenger Attendance {request.attendanceReference}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Review the record before signing.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 text-sm min-[480px]:grid-cols-2 sm:mt-6">
          <Detail label="Boat" value={`${request.boatName} (${request.registrationNumber})`} />
          <Detail label="Trip" value={request.tripId} />
          <Detail label="Trip date" value={formatDate(request.tripDateUtc)} />
          <Detail label="Monitoring Officer" value={request.monitoringOfficer} />
          <Detail label="Requested by" value={request.requestedByName} />
          <Detail label="Requested at" value={formatDate(request.requestedAtUtc)} />
        </dl>

        {readOnly ? (
          <div className="mt-6">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 size={19} aria-hidden="true" />
              <b>{request.status}</b>
            </div>
            {request.signatureData && (
              <img
                src={request.signatureData}
                alt="Issued signature"
                className="mt-3 h-24 w-full rounded-lg border object-contain sm:h-28"
              />
            )}
            {request.signedAtUtc && (
              <p className="mt-2 text-xs text-slate-500">Signed at {formatDate(request.signedAtUtc)}</p>
            )}
          </div>
        ) : (
          <div className="mt-6 min-w-0">
            <SignaturePad label="Your Signature" onChange={setSignature} disabled={busy} />
            {showDecline && (
              <label className="mt-4 block text-sm font-medium">
                Reason for declining (optional)
                <textarea
                  value={declineReason}
                  onChange={(event) => setDeclineReason(event.target.value)}
                  maxLength={1000}
                  className="mt-1 h-20 w-full resize-y rounded-lg border p-3"
                />
              </label>
            )}
            {error && <p role="alert" className="mt-3 break-words text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {showDecline ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setShowDecline(false)}
                    className="min-h-11 rounded-lg border px-5 py-2.5 font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decline()}
                    className="min-h-11 rounded-lg bg-red-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
                  >
                    Confirm Decline
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDecline(true)}
                  className="min-h-11 rounded-lg border border-red-300 px-5 py-2.5 font-semibold text-red-700"
                >
                  Decline
                </button>
              )}
              <button
                type="button"
                disabled={busy || !signature}
                onClick={() => void sign()}
                className="min-h-11 rounded-lg bg-emerald-600 px-6 py-2.5 font-semibold text-white disabled:opacity-40"
              >
                {busy ? 'Saving...' : 'Sign'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase text-slate-400">{label}</dt>
      <dd className="mt-1 break-words font-semibold">{value}</dd>
    </div>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { AuthApiError, deleteMyAccount } from '../auth/authApi';
import { useAuth } from '../auth/useAuth';

export const deletionDescription = 'Delete your account permanently from the Whale-Watching & Boat Monitoring System.';

export default function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current || confirmation !== 'confirm' || !session) return;
    pending.current = true;
    setBusy(true); setError('');
    try {
      await deleteMyAccount(session.accessToken, confirmation);
      sessionStorage.setItem('wwms-account-deleted', 'true');
      logout();
      navigate('/login', { replace: true, state: { accountDeleted: true } });
    } catch (reason) {
      setError(reason instanceof AuthApiError ? reason.message : 'Your account could not be deleted. Check your connection and try again.');
      pending.current = false; setBusy(false);
    }
  }

  return <dialog ref={dialog} aria-labelledby="delete-account-title" aria-describedby="delete-account-warning"
    onCancel={event => { event.preventDefault(); if (!pending.current) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-3xl bg-white p-6 text-slate-800 shadow-2xl backdrop:bg-slate-950/55 sm:p-8">
    <form onSubmit={submit} aria-busy={busy}>
      <AlertTriangle className="mb-3 text-red-600" aria-hidden="true" />
      <h2 id="delete-account-title" className="text-xl font-semibold text-[#162d54]">Delete My Account</h2>
      <p className="mt-3 text-sm">{deletionDescription}</p>
      <div id="delete-account-warning" className="mt-4 space-y-3 text-sm leading-6">
        <p className="font-semibold text-red-700">This action is permanent and cannot be undone.</p>
        <p>Sign-in and profile access will be permanently removed. Trip, passenger, safety and audit records and required identity references are retained.</p>
        <p>Active boats must be reassigned or removed, and ongoing trip assignments must end before deletion.</p>
      </div>
      <label htmlFor="delete-account-confirmation" className="mt-5 block text-sm font-semibold">Type exactly <strong>confirm</strong> to permanently delete your account</label>
      <input id="delete-account-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)}
        placeholder="Type confirm to continue" autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={busy}
        aria-describedby={error ? 'delete-account-error' : undefined}
        className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
      {error && <p id="delete-account-error" role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-xl border border-slate-300 px-4 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={confirmation !== 'confirm' || busy} className="min-h-11 rounded-xl bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Deleting account...' : 'Permanently delete account'}</button>
      </div>
    </form>
  </dialog>;
}

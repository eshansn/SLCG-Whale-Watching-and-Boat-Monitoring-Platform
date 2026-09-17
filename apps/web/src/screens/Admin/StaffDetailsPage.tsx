import { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Save, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Icon } from '../../components/ui/icon';
import { staffApi, STAFF_ROLES, WILDLIFE_STAFF_ROLES, type StaffMember, type StaffRole } from './staffApi';

export default function StaffDetailsPage() {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const isWildlifeAdmin = session?.roles.includes('Wildlife') && !session.roles.includes('Admin');
  const roles = isWildlifeAdmin ? WILDLIFE_STAFF_ROLES : STAFF_ROLES;
  const basePath = isWildlifeAdmin ? '/wildlife' : '/admin';
  const [staff, setStaff] = useState<StaffMember>();
  const [draft, setDraft] = useState<StaffMember>();
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session || !staffId) return;
    void staffApi.get(session.accessToken, staffId).then((item) => { setStaff(item); setDraft(item); }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load staff.'));
  }, [session, staffId]);
  if (error && !staff) return <main className="p-12 text-center text-red-600">{error}</main>;
  if (!staff || !draft) return <main className="p-12 text-center">Loading staff member...</main>;
  const save = async () => {
    if (!session || busy) return;
    setBusy(true); setError(''); setMessage('');
    try { const updated = await staffApi.update(session.accessToken, staff.id, draft); setStaff(updated); setDraft(updated); setMessage('Account updated.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Update failed.'); }
    finally { setBusy(false); }
  };
  const resetPassword = async () => {
    if (!session || busy || temporaryPassword.length < 12) return;
    setBusy(true); setError(''); setMessage('');
    try { const result = await staffApi.resetPassword(session.accessToken, staff.id, temporaryPassword); setTemporaryPassword(''); setMessage(result.message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Password reset failed.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!session || !window.confirm(`Delete ${staff.displayName}? This cannot be undone.`)) return;
    try { await staffApi.remove(session.accessToken, staff.id); navigate(`${basePath}/manage-staff`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Delete failed.'); }
  };
  return <main className="mx-auto max-w-3xl px-6 py-10"><button type="button" onClick={() => navigate(`${basePath}/manage-staff`)} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700"><ArrowLeft size={19} /> Back to users</button><section className="mt-6 rounded-2xl bg-white p-7 shadow-sm"><div className="flex justify-between gap-5"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-full bg-indigo-50"><Icon name="user" size={25} /></div><div><h1 className="text-2xl font-semibold">{staff.displayName}</h1><p className="text-sm text-slate-500">{staff.email}</p></div></div><button type="button" onClick={() => void remove()} aria-label={`Delete ${staff.displayName}`} className="rounded-full border border-red-200 p-2.5 text-red-600 hover:bg-red-50"><Trash2 size={19} /></button></div>{error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}<div className="mt-8 grid gap-4 border-t pt-7 sm:grid-cols-2">{([['displayName', 'Full name', 'text'], ['userName', 'Username', 'text'], ['email', 'Email', 'email'], ['phoneNumber', 'Phone number', 'tel']] as const).map(([key, label, type]) => <label key={key} className="text-xs font-semibold">{label}<input type={type} required={key !== 'phoneNumber'} value={draft[key] ?? ''} onChange={(event) => setDraft((current) => current ? { ...current, [key]: event.target.value } : current)} className="mt-1 h-11 w-full rounded-lg border px-3 text-sm font-normal" /></label>)}<label className="text-xs font-semibold">Role<select value={draft.role} onChange={(event) => setDraft((current) => current ? { ...current, role: event.target.value as StaffRole } : current)} className="mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm font-normal">{roles.map((role) => <option key={role}>{role}</option>)}</select></label><label className="flex items-center gap-3 self-end rounded-lg border p-3 text-sm font-semibold"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => current ? { ...current, isActive: event.target.checked } : current)} className="h-4 w-4" /> Active account</label></div><button type="button" disabled={busy || !draft.displayName.trim() || !draft.userName.trim() || !draft.email.trim()} onClick={() => void save()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#14223d] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Save size={17} /> Save changes</button><div className="mt-8 border-t pt-7"><h2 className="font-semibold">Set temporary password</h2><p className="mt-1 text-xs text-slate-500">The user can sign in with this password and change it from their account.</p><div className="mt-3 flex flex-col gap-3 sm:flex-row"><input type="password" minLength={12} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} placeholder="Minimum 12 characters" className="h-11 flex-1 rounded-lg border px-3 text-sm" /><button type="button" disabled={busy || temporaryPassword.length < 12} onClick={() => void resetPassword()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 px-5 py-2.5 text-sm font-semibold text-indigo-700 disabled:opacity-40"><KeyRound size={17} /> Reset password</button></div></div></section></main>;
}

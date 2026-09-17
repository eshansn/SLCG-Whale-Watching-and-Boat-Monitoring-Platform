import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, Plus, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Icon } from '../../components/ui/icon';
import { staffApi, STAFF_ROLES, WILDLIFE_STAFF_ROLES, type StaffMember, type StaffRole } from './staffApi';

export default function ManageStaff() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const isWildlifeAdmin = session?.roles.includes('Wildlife') && !session.roles.includes('Admin');
  const roles = isWildlifeAdmin ? WILDLIFE_STAFF_ROLES : STAFF_ROLES;
  const basePath = isWildlifeAdmin ? '/wildlife' : '/admin';
  const empty = { displayName: '', userName: '', role: roles[0] as StaffRole, email: '', phoneNumber: '', password: '', confirmPassword: '' };
  const [rows, setRows] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try { setRows(await staffApi.list(session.accessToken)); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load staff.'); }
    finally { setLoading(false); }
  }, [session]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const visible = useMemo(() => {
    const query = search.toLowerCase();
    return rows.filter((row) => [row.displayName, row.userName, row.email, row.role, row.phoneNumber ?? ''].some((value) => value.toLowerCase().includes(query)));
  }, [rows, search]);
  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) return;
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    try {
      await staffApi.create(session.accessToken, { ...form, isActive: true });
      setOpen(false); setForm(empty); setError(''); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to add staff.'); }
  };
  const remove = async (row: StaffMember) => {
    if (!session || !window.confirm(`Delete ${row.displayName}?`)) return;
    try { await staffApi.remove(session.accessToken, row.id); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete staff.'); }
  };
  return <main className="mx-auto max-w-7xl px-6 py-10"><section className="rounded-lg bg-white p-8 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-xl font-semibold">{isWildlifeAdmin ? 'Wildlife Users' : 'Staff'}</h1><p className="mt-1 text-xs text-slate-400">Manage secure WWMS portal accounts</p></div><div className="flex gap-3"><label className="flex items-center gap-2 rounded-md border px-3"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" className="h-11 outline-none" /></label><button type="button" onClick={() => setOpen(true)} aria-label="Add staff" className="grid h-11 w-11 place-items-center rounded-full bg-[#14223d] text-white"><Plus size={20} /></button></div></div>{error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-600">{error}</p>}<div className="mt-7 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b text-xs text-slate-400"><tr><th className="py-3">Name</th><th>Username</th><th>Role</th><th>Email</th><th>Status</th><th className="text-right">Actions</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="py-4 font-semibold">{row.displayName}</td><td>{row.userName}</td><td>{row.role}</td><td>{row.email}</td><td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{row.isActive ? 'Active' : 'Inactive'}</span></td><td className="text-right"><button type="button" onClick={() => navigate(`${basePath}/staff-info/${row.id}`)} aria-label={`View ${row.displayName}`} className="mr-1 rounded-full p-2 text-indigo-700 hover:bg-indigo-50"><Eye size={18} /></button><button type="button" onClick={() => void remove(row)} aria-label={`Delete ${row.displayName}`} className="rounded-full p-2 text-red-600 hover:bg-red-50"><Trash2 size={18} /></button></td></tr>)}</tbody></table>{loading && <p className="py-10 text-center text-slate-400">Loading users...</p>}{!loading && !visible.length && <p className="py-10 text-center text-slate-400">No accounts found.</p>}</div></section>{open && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4"><form onSubmit={(event) => void add(event)} className="my-8 w-full max-w-lg rounded-2xl bg-white p-7"><div className="flex justify-between"><h2 className="text-xl font-semibold">Create {isWildlifeAdmin ? 'wildlife user' : 'staff account'}</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-2"><X size={20} /></button></div><div className="mt-5 grid gap-3">{([['displayName', 'Full name', 'text'], ['userName', 'Username', 'text'], ['email', 'Email', 'email'], ['phoneNumber', 'Phone number', 'tel'], ['password', 'Temporary password', 'password'], ['confirmPassword', 'Confirm password', 'password']] as const).map(([key, label, type]) => <label key={key} className="text-xs font-semibold">{label}<input required={key !== 'phoneNumber'} type={type} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 h-11 w-full rounded-lg border px-3 text-sm font-normal" /></label>)}<label className="text-xs font-semibold">Portal role<select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as StaffRole }))} className="mt-1 h-11 w-full rounded-lg border px-3 text-sm font-normal">{roles.map((role) => <option key={role}>{role}</option>)}</select></label></div><div className="mt-6 flex justify-end"><button aria-label="Create staff" className="inline-flex items-center gap-2 rounded-lg bg-[#14223d] px-5 py-2.5 text-sm font-semibold text-white"><Check size={18} /> Create</button></div></form></div>}</main>;
}

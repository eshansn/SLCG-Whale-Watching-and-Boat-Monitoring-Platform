import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { useAdminRecords } from './AdminRecordsContext';
import { AdminList, Sort, Status } from './BoatsPage';

export default function BoatCrewPage() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('name-asc');
  const [reviewOnly, setReviewOnly] = useState(false);
  const { crew, boats } = useAdminRecords();
  const base = useLocation().pathname.startsWith('/wildlife') ? '/wildlife' : '/admin';
  const reviewCount = crew.filter(m => m.approval === 'Approved' && !m.certificate?.canApprove).length;
  const rows = useMemo(() => crew.filter(m => `${m.name} ${m.role} ${m.email}`.toLowerCase().includes(q.toLowerCase()) &&
    (!reviewOnly || (m.approval === 'Approved' && !m.certificate?.canApprove)))
    .sort((a, b) => sort === 'name-desc' ? b.name.localeCompare(a.name) : sort === 'role' ? a.role.localeCompare(b.role)
      : sort === 'boat' ? (boats.find(x => x.id === a.boatId)?.name ?? '~').localeCompare(boats.find(x => x.id === b.boatId)?.name ?? '~')
      : sort === 'pending' ? Number(b.approval === 'Pending') - Number(a.approval === 'Pending') : a.name.localeCompare(b.name)), [q, sort, crew, boats, reviewOnly]);
  return <AdminList title="Boat crew" subtitle="Review, edit or delete crew records" search={q} setSearch={setQ}
    control={<Sort value={sort} onChange={setSort} options={[["name-asc", "Name A–Z"], ["name-desc", "Name Z–A"], ["role", "Role"], ["boat", "Current boat"], ["pending", "Pending first"]]} />}>
    <label className="my-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      <input type="checkbox" checked={reviewOnly} onChange={e => setReviewOnly(e.target.checked)} />
      Show approved crew requiring certificate review ({reviewCount})
    </label>
    <table className="w-full min-w-[800px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr>
      <th className="py-4">Crew member</th><th>Role</th><th>Current boat</th><th>Status</th><th>Certificate</th><th />
    </tr></thead><tbody>{rows.map(m => <tr key={m.id} className="border-b">
      <td className="py-5 font-semibold">{m.name}</td><td>{m.role}</td><td>{boats.find(b => b.id === m.boatId)?.name ?? 'Unassigned'}</td>
      <td><Status value={m.approval} /></td><td className={m.certificate?.canApprove ? 'text-emerald-700' : 'text-amber-800'}>
        {m.certificate?.status === 'Valid' ? 'Available' : m.certificate?.status ?? 'Status unavailable'}
        {m.approval === 'Approved' && !m.certificate?.canApprove && <span className="block text-xs">Manual review required</span>}
      </td><td className="text-right"><Link aria-label={`Open ${m.name}`} title="Open details" className="inline-flex rounded-full p-2 text-indigo-700 hover:bg-indigo-50" to={`${base}/crew/${m.id}`}><Eye size={19} /></Link></td>
    </tr>)}</tbody></table>
  </AdminList>;
}

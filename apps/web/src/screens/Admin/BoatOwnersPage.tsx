import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { useAdminRecords } from './AdminRecordsContext';
import { AdminList, Sort } from './BoatsPage';

export default function BoatOwnersPage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('name-asc');
  const { owners, boats } = useAdminRecords();
  const count = useCallback((id: string) => boats.filter((boat) => boat.ownerId === id).length, [boats]);
  const rows = useMemo(() => owners
    .filter((owner) => `${owner.name} ${owner.email} ${owner.nic}`.toLowerCase().includes(query.toLowerCase()))
    .sort((first, second) => sort === 'name-desc'
      ? second.name.localeCompare(first.name)
      : sort === 'boats-desc'
        ? count(second.id) - count(first.id)
        : sort === 'boats-asc'
          ? count(first.id) - count(second.id)
          : first.name.localeCompare(second.name)), [query, sort, owners, count]);

  return <AdminList title="Boat owners" subtitle="Edit, delete and view boats registered under each owner" search={query} setSearch={setQuery} control={<Sort value={sort} onChange={setSort} options={[["name-asc","Name A–Z"],["name-desc","Name Z–A"],["boats-desc","Most boats"],["boats-asc","Fewest boats"]]}/>}>
    <table className="w-full min-w-[680px] text-left text-sm">
      <thead className="border-b text-xs uppercase text-slate-400"><tr><th className="py-4">Owner</th><th>NIC</th><th>Phone</th><th>Boats</th><th/></tr></thead>
      <tbody>{rows.map((owner) => <tr key={owner.id} className="border-b"><td className="py-5"><p className="font-semibold">{owner.name}</p><p className="text-xs text-slate-500">{owner.email}</p></td><td>{owner.nic}</td><td>{owner.phone}</td><td>{count(owner.id)}</td><td className="text-right"><Link aria-label={`Open ${owner.name}`} title="Open details" className="inline-flex rounded-full p-2 text-indigo-700 hover:bg-indigo-50" to={`/admin/owners/${owner.id}`}><Eye size={19}/></Link></td></tr>)}</tbody>
    </table>
  </AdminList>;
}

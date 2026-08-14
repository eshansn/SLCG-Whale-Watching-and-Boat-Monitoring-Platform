import { useState } from 'react';
import { ArrowLeft, Eye, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdminRecords } from './AdminRecordsContext';
import EditRecordModal from './components/EditRecordModal';

export default function OwnerDetailsPage() {
  const { ownerId } = useParams();
  const nav = useNavigate();
  const records = useAdminRecords();
  const owner = records.owners.find((item) => item.id === ownerId);
  const [editing, setEditing] = useState(false);

  if (!owner) return <main className="p-10 text-center">Owner not found.</main>;

  const boats = records.boats.filter((boat) => boat.ownerId === owner.id);
  const remove = async () => {
    if (boats.length) {
      alert('This owner cannot be deleted while boats are registered under them. Reassign or delete those boats first.');
      return;
    }
    if (confirm(`Delete ${owner.name}? This cannot be undone.`)) {
      try {
        await records.deleteOwner(owner.id);
        nav('/admin/manage-boat-owners');
      } catch (reason) {
        alert(reason instanceof Error ? reason.message : 'The boat owner could not be deleted.');
      }
    }
  };

  return <main className="mx-auto max-w-6xl px-6 py-10">
    <div className="flex justify-between">
      <button onClick={() => nav(-1)} aria-label="Back to owners" title="Back" className="rounded-full p-2 text-indigo-700 hover:bg-indigo-50"><ArrowLeft size={20}/></button>
      <div className="flex gap-3">
        <button onClick={() => setEditing(true)} aria-label="Edit owner" title="Edit" className="rounded-full border p-2.5"><Pencil size={19}/></button>
        <button onClick={() => void remove()} aria-label="Delete owner" title="Delete" className="rounded-full bg-red-600 p-2.5 text-white"><Trash2 size={19}/></button>
      </div>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[330px_1fr]">
      <section className="rounded-2xl bg-white p-7 shadow-sm">
        <h1 className="text-2xl font-semibold">{owner.name}</h1>
        <p className="text-sm text-slate-400">Boat owner</p>
        <div className="mt-7 space-y-5">{[['NIC', owner.nic], ['Email', owner.email], ['Phone', owner.phone], ['Address', owner.address]].map(([label, value]) => <div key={label}><p className="text-xs uppercase text-slate-400">{label}</p><p className="font-medium">{value}</p></div>)}</div>
      </section>
      <section className="rounded-2xl bg-white p-7 shadow-sm">
        <h2 className="text-lg font-semibold">Registered boats ({boats.length})</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">{boats.map((boat) => <Link key={boat.id} aria-label={`View ${boat.name}`} title="View boat" to={`/admin/boats/${boat.id}`} className="flex items-center justify-between rounded-xl border p-5"><span><span className="block font-semibold">{boat.name}</span><span className="text-sm text-slate-500">{boat.registrationNumber}</span></span><Eye size={19} className="text-indigo-700"/></Link>)}</div>
      </section>
    </div>
    {editing && (
      <EditRecordModal title="owner" fields={[{key:'name',label:'Full name'},{key:'nic',label:'NIC'},{key:'email',label:'Email',type:'email'},{key:'phone',label:'Phone'},{key:'address',label:'Address'}]} initial={owner} onClose={() => setEditing(false)} onSave={async (values) => { try { await records.updateOwner(owner.id, values); setEditing(false); } catch (reason) { alert(reason instanceof Error ? reason.message : 'The boat owner could not be updated.'); } }}/>
    )}
  </main>;
}

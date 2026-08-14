import { useState } from 'react';
import { ArrowLeft, Eye, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdminRecords } from './AdminRecordsContext';
import ApprovalControls from './components/ApprovalControls';
import EditRecordModal from './components/EditRecordModal';
import TripHistory from './components/TripHistory';

export default function CrewDetailsPage() {
  const { crewId } = useParams();
  const nav = useNavigate();
  const records = useAdminRecords();
  const member = records.crew.find((item) => item.id === crewId);
  const [editing, setEditing] = useState(false);

  if (!member) return <main className="p-10 text-center">Crew member not found.</main>;

  const boat = records.boats.find((item) => item.id === member.boatId);
  const remove = async () => {
    if (confirm(`Delete ${member.name}? This removes the member from their boat. This cannot be undone.`)) {
      try {
        await records.deleteCrew(member.id);
        nav('/admin/manage-boat-crew');
      } catch (reason) {
        alert(reason instanceof Error ? reason.message : 'The crew member could not be deleted.');
      }
    }
  };

  return <main className="mx-auto max-w-6xl px-6 py-10">
    <div className="flex justify-between">
      <button onClick={() => nav(-1)} aria-label="Back to crew" title="Back" className="rounded-full p-2 text-indigo-700 hover:bg-indigo-50"><ArrowLeft size={20}/></button>
      <div className="flex gap-3">
        <button onClick={() => setEditing(true)} aria-label="Edit crew member" title="Edit" className="rounded-full border p-2.5"><Pencil size={19}/></button>
        <button onClick={() => void remove()} aria-label="Delete crew member" title="Delete" className="rounded-full bg-red-600 p-2.5 text-white"><Trash2 size={19}/></button>
      </div>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[330px_1fr]">
      <section className="rounded-2xl bg-white p-7 shadow-sm">
        <h1 className="text-2xl font-semibold">{member.name}</h1>
        <p className="text-sm text-slate-400">{member.role}</p>
        <div className="mt-7 space-y-5">{[['NIC', member.nic], ['Email', member.email], ['Phone', member.phone], ['Address', member.address]].map(([label, value]) => <div key={label}><p className="text-xs uppercase text-slate-400">{label}</p><p className="font-medium">{value}</p></div>)}</div>
        <h2 className="mt-7 border-t pt-6 text-sm font-semibold">Certifications</h2>
        {member.certifications.map((certification) => <p key={certification} className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">{certification}</p>)}
      </section>
      <div className="space-y-6">
        <ApprovalControls key={`${member.approval}-${member.declineReason}`} initialStatus={member.approval} initialReason={member.declineReason} onChange={(status, reason) => records.setCrewApproval(member.id, status, reason)}/>
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Currently working on</h2>
          {boat ? <Link aria-label={`View ${boat.name}`} title="View boat" to={`/admin/boats/${boat.id}`} className="mt-4 flex items-center justify-between rounded-xl border p-5"><span className="font-semibold">{boat.name}</span><Eye size={19} className="text-indigo-700"/></Link> : <p className="mt-4 text-sm text-slate-500">Unassigned</p>}
        </section>
        <TripHistory tripIds={member.tripIds}/>
      </div>
    </div>
    {editing && (
      <EditRecordModal title="crew member" fields={[{key:'name',label:'Full name'},{key:'nic',label:'NIC'},{key:'email',label:'Email',type:'email'},{key:'phone',label:'Phone'},{key:'address',label:'Address'},{key:'role',label:'Role',type:'select',options:['Captain','Life Saver','Deck Hand'].map((role)=>({label:role,value:role}))},{key:'boatId',label:'Current boat',type:'select',options:[{label:'Unassigned',value:''},...records.boats.map((item)=>({label:item.name,value:item.id}))]}]} initial={member} onClose={() => setEditing(false)} onSave={async (values) => { try { await records.updateCrew(member.id, {...values, role: values.role as typeof member.role, boatId: values.boatId ? String(values.boatId) : undefined}); setEditing(false); } catch (reason) { alert(reason instanceof Error ? reason.message : 'The crew member could not be updated.'); } }}/>
    )}
  </main>;
}

import { useState, type ReactNode } from 'react';
import { ArrowLeft, Download, Eye, Pencil, Ship, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { operationsApi } from '../../operations/operationsApi';
import { useAdminRecords } from './AdminRecordsContext';
import ApprovalControls from './components/ApprovalControls';
import BoatReportModal from './components/BoatReportModal';
import EditRecordModal from './components/EditRecordModal';
import { RecordUnavailable, RecordsErrorNotice } from './components/RecordsLoadState';
import TripHistory from './components/TripHistory';

export default function BoatDetailsPage() {
  const { id, fleetId, boatId } = useParams();
  const nav = useNavigate();
  const { session } = useAuth();
  const records = useAdminRecords();
  const boat = records.boats.find(item => item.id === (boatId ?? fleetId ?? id));
  const [editing, setEditing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!boat) return <RecordUnavailable loading={records.loading} error={records.error} onRetry={records.reload} notFound="Boat not found."/>;

  const owner = records.owners.find(item => item.id === boat.ownerId);
  const ownerCrew = records.crew.filter(item => item.ownerId === boat.ownerId);
  const prefix = session?.roles.includes('Wildlife') ? '/wildlife' : '/admin';
  const isAdmin = session?.roles.includes('Admin') ?? false;

  const remove = async () => {
    if (!confirm(`Delete ${boat.name}? Crew members will become unassigned. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await records.deleteBoat(boat.id);
      nav(`${prefix}/boats`);
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : 'The boat could not be deleted.');
      setDeleting(false);
    }
  };

  const openDocument = async (documentId: string, download = false) => {
    if (!session || !boat.apiId) return;
    const url = await operationsApi.downloadBoatDocument(session.accessToken, boat.apiId, documentId);
    if (download) {
      const link = document.createElement('a');
      link.href = url;
      link.download = boat.documents?.find(item => item.id === documentId)?.fileName ?? 'certificate';
      link.click();
    } else window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return <main className="mx-auto max-w-7xl px-6 py-10">
    <RecordsErrorNotice error={records.error} onRetry={records.reload}/>
    <div className="flex justify-between">
      <button onClick={() => nav(-1)} aria-label="Back to boats" title="Back" className="rounded-full p-2 text-indigo-700"><ArrowLeft size={20}/></button>
      <div className="flex gap-3">
        {isAdmin && session && <button onClick={() => setReportOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#14223d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#22375f]"><Download size={18}/>Download boat report</button>}
        <button onClick={() => setEditing(true)} aria-label="Edit boat" title="Edit" className="rounded-full border p-2.5"><Pencil size={19}/></button>
        {isAdmin && <button disabled={deleting} onClick={() => void remove()} aria-label="Delete boat" title="Delete" className="rounded-full bg-red-600 p-2.5 text-white disabled:opacity-50"><Trash2 size={19}/></button>}
      </div>
    </div>

    <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-6">
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {boat.imageUrl ? <img src={boat.imageUrl} alt={boat.name} className="h-48 w-full object-cover"/> : <div className="grid h-48 place-items-center bg-blue-50"><Ship size={55} className="text-blue-300"/></div>}
          <div className="p-6">
            <h1 className="text-2xl font-semibold">{boat.name}</h1>
            <p className="text-sm text-slate-500">{boat.registrationNumber}</p>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              {[['Registered', boat.registrationDate], ['Hull no.', boat.hullNumber], ['Capacity', boat.capacity], ['Length', boat.length], ['Width', boat.width]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-400">{label}</dt><dd className="font-semibold">{value}</dd></div>)}
            </dl>
          </div>
        </section>
        <ApprovalControls key={`${boat.approval}-${boat.declineReason}`} initialStatus={boat.approval} initialReason={boat.declineReason} onChange={(status, reason) => records.setBoatApproval(boat.id, status, reason)}/>
      </aside>

      <div className="space-y-6">
        <Card title="Owner">{owner && <Link aria-label={`View ${owner.name}`} title="View owner" to={`${prefix}/owners/${owner.id}`} className="mt-4 flex justify-between rounded-xl border p-4"><b>{owner.name}</b><Eye size={19} className="text-indigo-700"/></Link>}</Card>
        <Card title={`Owner's crew (${ownerCrew.length})`}><div className="mt-4 grid gap-3 sm:grid-cols-2">{ownerCrew.map(member => <Link key={member.id} aria-label={`View ${member.name}`} title="View crew member" to={`${prefix}/crew/${member.id}`} className="flex justify-between rounded-xl border p-4"><span><b className="block">{member.name}</b><span className="text-xs text-slate-500">{member.role}</span></span><Eye size={18} className="text-indigo-700"/></Link>)}</div></Card>
        <Card title="Certifications"><div className="mt-4 grid gap-3 sm:grid-cols-2">{boat.documents?.map(item => <article key={item.id} className="rounded-lg bg-slate-50 p-4"><p className="font-semibold">{item.name}</p><p className="truncate text-xs text-slate-500">{item.fileName}</p>{item.expirationDate&&<p className="mt-1 text-xs font-medium text-amber-700">Expires {new Intl.DateTimeFormat('en-LK',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(`${item.expirationDate}T00:00:00Z`))}</p>}<div className="mt-3 flex gap-2"><button onClick={() => void openDocument(item.id)} aria-label={`View ${item.name}`} title="View" className="rounded-full p-2 text-indigo-700"><Eye size={18}/></button><button onClick={() => void openDocument(item.id, true)} aria-label={`Download ${item.name}`} title="Download" className="rounded-full p-2 text-indigo-700"><Download size={18}/></button></div></article>)}</div></Card>
        <TripHistory tripIds={boat.tripIds}/>
      </div>
    </div>

    {editing && (
      <EditRecordModal title="boat" fields={[{key:'name',label:'Boat name'},{key:'registrationNumber',label:'Registration number'},{key:'registrationDate',label:'Registration date',type:'date'},{key:'hullNumber',label:'Hull number'},{key:'capacity',label:'Maximum capacity',type:'number'},{key:'length',label:'Length'},{key:'width',label:'Width'},{key:'ownerId',label:'Owner',type:'select',options:records.owners.map(item=>({label:item.name,value:item.id}))}]} initial={boat} onClose={() => setEditing(false)} onSave={async values => { try { await records.updateBoat(boat.id, {...values, capacity:Number(values.capacity), ownerId:String(values.ownerId)}); setEditing(false); } catch (reason) { alert(reason instanceof Error ? reason.message : 'The boat could not be updated.'); } }}/>
    )}
    {reportOpen && session && (
      <BoatReportModal boat={boat} owner={owner} crew={ownerCrew} token={session.accessToken} onClose={() => setReportOpen(false)}/>
    )}
  </main>;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold">{title}</h2>{children}</section>;
}

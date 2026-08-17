import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { useAuth } from '../../auth/useAuth';
import { wildlifeApi, watchAttendance, type Attendance, type MonitoringRecord, type WildlifeTrip } from './shoreWildlifeApi';
import { ChevronDown, ChevronUp, Eye } from 'lucide-react';

const formatDate=(v:string)=>new Intl.DateTimeFormat('en-LK',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
const Shell=({title,sub,children}:{title:string;sub:string;children:React.ReactNode})=><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><h1 className="text-3xl font-semibold text-[#14223d]">{title}</h1><p className="mt-1 text-sm text-slate-500">{sub}</p><div className="mt-7">{children}</div></main>;
const Badge=({value}:{value:string})=>{const c=value==='Approved'?'bg-emerald-50 text-emerald-700':value==='Rejected'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700';return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${c}`}>{value}</span>};

export function WildlifeTrips(){
 const{session}=useAuth();const nav=useNavigate();const[items,setItems]=useState<WildlifeTrip[]>([]);const[query,setQuery]=useState('');const[sort,setSort]=useState('newest');const[error,setError]=useState('');const[loading,setLoading]=useState(true);const[retryVersion,setRetryVersion]=useState(0);
 useEffect(()=>{if(!session)return;let active=true;void wildlifeApi.trips(session.accessToken).then(nextItems=>{if(!active)return;setItems(nextItems);setError('')}).catch(loadError=>{if(!active)return;setError(loadError instanceof Error?loadError.message:'Unable to load Wildlife trips.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[session,retryVersion]);
 const retry=()=>{setLoading(true);setRetryVersion(version=>version+1)};
 const visible=useMemo(()=>items.filter(x=>[x.boatName,x.registrationNumber,x.ownerName,x.route,x.status,x.wildlifeShoreApproval].some(v=>v.toLowerCase().includes(query.trim().toLowerCase()))).sort((a,b)=>sort==='oldest'?+new Date(a.scheduledDepartureUtc)-+new Date(b.scheduledDepartureUtc):sort==='name'?a.boatName.localeCompare(b.boatName):sort==='approval'?a.wildlifeShoreApproval.localeCompare(b.wildlifeShoreApproval):+new Date(b.scheduledDepartureUtc)-+new Date(a.scheduledDepartureUtc)),[items,query,sort]);
 return <Shell title="Trips" sub="Monitor attendance and complete Wildlife Shore approval"><section className="overflow-hidden rounded-xl bg-white shadow-sm"><div className="flex flex-col gap-3 border-b p-5 sm:flex-row"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search vessel, owner, registration or route" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400"/><select value={sort} onChange={e=>setSort(e.target.value)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Vessel A–Z</option><option value="approval">Approval status</option></select></div>{error&&<div role="alert" className="flex items-center justify-between gap-3 p-5 text-red-600"><span>{error}</span><button type="button" disabled={loading} onClick={retry} className="shrink-0 font-semibold underline disabled:opacity-50">{loading?'Retrying…':'Retry'}</button></div>}<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50/70 text-xs text-slate-500"><tr><th className="px-6 py-4">Vessel</th><th className="px-5 py-4">Owner</th><th className="px-5 py-4">Scheduled</th><th className="px-5 py-4">SLCG</th><th className="px-5 py-4">Wildlife Shore</th><th className="px-6 py-4 text-right">Action</th></tr></thead><tbody className="divide-y">{visible.map(x=><tr key={x.id} className="hover:bg-slate-50"><td className="px-6 py-5"><b>{x.boatName}</b><p className="text-xs text-slate-400">{x.registrationNumber}</p></td><td className="px-5 py-5">{x.ownerName}</td><td className="px-5 py-5">{formatDate(x.scheduledDepartureUtc)}</td><td className="px-5 py-5"><Badge value={x.shoreApproval}/></td><td className="px-5 py-5"><Badge value={x.wildlifeShoreApproval}/></td><td className="px-6 py-5 text-right"><button onClick={()=>nav(`/shore-wildlife/trips/${x.id}`)} aria-label={`Review ${x.boatName}`} title="Review" className="rounded-full border border-indigo-200 p-2 text-indigo-700 hover:bg-indigo-50"><Eye size={18}/></button></td></tr>)}</tbody></table></div>{loading&&!items.length&&!error&&<p className="p-12 text-center text-sm text-slate-400">Loading trips…</p>}{!loading&&!error&&visible.length===0&&<p className="p-12 text-center text-sm text-slate-400">No trips match your search.</p>}</section></Shell>;
}

function Breakdown({a}:{a:Attendance}){return <section className="rounded-xl bg-white p-6 shadow-sm"><div className="flex flex-wrap justify-between"><div><h2 className="text-xl font-semibold">Passenger Attendance</h2><p className="mt-1 text-sm font-semibold text-emerald-600">● Live Attendance</p></div><p className="text-xs text-slate-500">Last updated: {formatDate(a.lastUpdatedUtc)}</p></div><div className="mt-6 grid gap-4 md:grid-cols-2"><Group name="LOCAL" x={a.local}/><Group name="FOREIGN" x={a.foreign}/></div><div className="mt-5 rounded-xl bg-[#14223d] p-5 text-white"><p className="text-xs uppercase">Total present</p><p className="text-4xl font-bold">{a.totalPresent}</p></div></section>}
function Group({name,x}:{name:string;x:Attendance['local']}){return <div className="rounded-xl border p-5"><h3 className="font-semibold">{name}</h3>{[['Adult',x.adult],['Child',x.child],['Small (Under 6 Y)',x.small]].map(([l,v])=><div key={String(l)} className="mt-3 flex justify-between text-sm"><span>{l}</span><b>{v}</b></div>)}<div className="mt-4 flex justify-between border-t pt-3 font-semibold"><span>Total</span><b>{x.total}</b></div></div>}

export function WildlifeTripDetails(){
 const{id=''}=useParams();const{session}=useAuth();const nav=useNavigate();const[a,setA]=useState<Attendance>();const[storedRecord,setRecord]=useState<MonitoringRecord>();const[form,setForm]=useState({ticketNumber:'',tidNumber:'',monitoringOfficer:'',supervisor:''});const[formTripId,setFormTripId]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false);const[recordLoad,setRecordLoad]=useState({requestedTripId:'',error:''});const[recordsLoading,setRecordsLoading]=useState(true);const[recordsRetry,setRecordsRetry]=useState(0);const recordIsCurrent=recordLoad.requestedTripId===id;const record=recordIsCurrent?storedRecord:undefined;const recordError=recordIsCurrent?recordLoad.error:'';const recordLoading=recordsLoading||!recordIsCurrent;const currentForm=formTripId===id?form:{ticketNumber:'',tidNumber:'',monitoringOfficer:'',supervisor:''};
 const load=useCallback(()=>{if(session)wildlifeApi.attendance(session.accessToken,id).then(setA).catch(e=>setError(e.message))},[session,id]);useEffect(()=>{load();if(session)return watchAttendance(session.accessToken,load)},[load,session]);
 useEffect(()=>{if(!session)return;let active=true;void wildlifeApi.records(session.accessToken).then(rows=>{if(!active)return;const existing=rows.find(x=>x.tripId===id);setRecord(existing);setForm(existing?{ticketNumber:existing.ticketNumber,tidNumber:existing.tidNumber,monitoringOfficer:existing.monitoringOfficer,supervisor:existing.supervisor}:{ticketNumber:'',tidNumber:'',monitoringOfficer:'',supervisor:''});setFormTripId(id);setRecordLoad({requestedTripId:id,error:''})}).catch(loadError=>{if(!active)return;setRecord(undefined);setForm({ticketNumber:'',tidNumber:'',monitoringOfficer:'',supervisor:''});setFormTripId(id);setRecordLoad({requestedTripId:id,error:loadError instanceof Error?loadError.message:'Unable to load monitoring information.'})}).finally(()=>{if(active)setRecordsLoading(false)});return()=>{active=false}},[session,id,recordsRetry]);
 const retryRecords=()=>{setRecordsLoading(true);setRecordsRetry(version=>version+1)};
 const request=async()=>{if(!session||recordLoading||recordError)return;setBusy(true);setError('');try{let r=record;if(!r)r=await wildlifeApi.create(session.accessToken,{tripId:id,...currentForm});setRecord(await wildlifeApi.requestSignature(session.accessToken,r.id,currentForm))}catch(e){setError(e instanceof Error?e.message:'Unable to save')}finally{setBusy(false)}};
 const approve=async(value:'Approved'|'Rejected')=>{if(!session)return;setBusy(true);setError('');try{await wildlifeApi.approve(session.accessToken,id,value);load()}catch(e){setError(e instanceof Error?e.message:'Approval failed')}finally{setBusy(false)}};
 if(!a)return <Shell title="Trip monitoring" sub="Loading latest attendance…"><p>{error}</p></Shell>;
 const boatApproval=a.certificationApproval==='Approved'||a.boatWildlifeApproval==='Approved'?'Approved':a.certificationApproval==='Rejected'&&a.boatWildlifeApproval==='Rejected'?'Rejected':'Pending';
 const signaturesComplete=Boolean(record?.monitoringOfficerSignature&&record?.supervisorSignature&&record?.harbourOfficerSignature&&record?.harbourOfficerName);
 return <Shell title={a.boatName} sub={`${a.registrationNumber} · ${formatDate(a.scheduledDepartureUtc)}`}><button onClick={()=>nav('/shore-wildlife')} className="mb-5 text-sm font-semibold text-indigo-700">← Trips</button><div className="grid gap-6 lg:grid-cols-[1fr_.9fr]"><div className="space-y-6"><section className="rounded-xl bg-white p-6 shadow-sm"><h2 className="font-semibold">Trip Information</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Info l="Trip reference" v={a.tripId}/><Info l="Boat operator" v={a.ownerName}/><Info l="Route" v={a.route}/><Info l="Status" v={a.tripStatus}/></dl><div className="mt-5 grid grid-cols-3 gap-3 text-sm"><div>Boat approval<br/><Badge value={boatApproval}/></div><div>SLCG Shore<br/><Badge value={a.shoreApproval}/></div><div>Wildlife Shore<br/><Badge value={a.wildlifeShoreApproval}/></div></div></section><Breakdown a={a}/></div><section className="rounded-xl bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Monitoring Information</h2><div className="mt-5 grid gap-4">{(['ticketNumber','tidNumber','monitoringOfficer','supervisor'] as const).map(k=><label key={k} className="text-sm font-medium">{{ticketNumber:'Ticket Number',tidNumber:'TID Number',monitoringOfficer:'Monitoring Officer',supervisor:'Supervisor'}[k]}<input disabled={recordLoading||Boolean(recordError)||record?.status==='Completed'} value={currentForm[k]} onChange={e=>setForm({...currentForm,[k]:e.target.value})} maxLength={k==='ticketNumber'||k==='tidNumber'?80:160} className="mt-1 block w-full rounded-lg border px-3 py-2.5"/></label>)}</div>{recordLoading&&!recordError&&<p className="mt-4 text-sm text-slate-400">Loading monitoring information…</p>}{recordError&&<div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"><span>{recordError}</span><button type="button" disabled={recordLoading} onClick={retryRecords} className="shrink-0 font-semibold underline disabled:opacity-50">{recordLoading?'Retrying…':'Retry'}</button></div>}{error&&<p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{record&&((record.status==='PendingHarbourSignature')||(record.status==='Completed'&&!signaturesComplete))?<SignatureSection record={record} token={session!.accessToken} done={r=>{setRecord(r);setError('')}}/>:<button disabled={recordLoading||Boolean(recordError)||busy||record?.status==='Completed'||Object.values(currentForm).some(v=>!v.trim())} onClick={request} className="mt-6 w-full rounded-lg bg-[#14223d] px-4 py-3 font-semibold text-white disabled:opacity-40">{busy?'Saving…':signaturesComplete?'All signatures completed':'Request Signatures'}</button>}{record?.status==='Completed'&&signaturesComplete&&<div className="mt-7 border-t pt-5"><h3 className="font-semibold">Wildlife Shore Approval</h3><p className="mt-1 text-xs text-slate-500">All monitoring fields and signatures are complete.</p><div className="mt-4 flex gap-3"><button disabled={busy} onClick={()=>approve('Rejected')} className="flex-1 rounded-lg border border-red-300 py-2.5 font-semibold text-red-700">Reject</button><button disabled={busy||a.wildlifeShoreApproval==='Approved'} onClick={()=>approve('Approved')} className="flex-1 rounded-lg bg-emerald-600 py-2.5 font-semibold text-white disabled:opacity-50">Approve Trip</button></div></div>}</section></div></Shell>;
}

function SignaturePad({label,onChange}:{label:string;onChange:(v:string)=>void}){const ref=useRef<HTMLCanvasElement>(null);const[drawing,setDrawing]=useState(false);const[hasInk,setHasInk]=useState(false);const pos=(e:PointerEvent<HTMLCanvasElement>)=>{const c=ref.current!,r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}};const start=(e:PointerEvent<HTMLCanvasElement>)=>{const c=ref.current!,p=pos(e),x=c.getContext('2d')!;x.beginPath();x.moveTo(p.x,p.y);setDrawing(true);e.currentTarget.setPointerCapture(e.pointerId)};const move=(e:PointerEvent<HTMLCanvasElement>)=>{if(!drawing)return;const c=ref.current!,p=pos(e),x=c.getContext('2d')!;x.lineWidth=3;x.lineCap='round';x.strokeStyle='#14223d';x.lineTo(p.x,p.y);x.stroke();setHasInk(true);onChange(c.toDataURL('image/png'))};const clear=()=>{ref.current?.getContext('2d')?.clearRect(0,0,700,180);setHasInk(false);onChange('')};return <div><div className="mb-2 flex justify-between"><label className="text-sm font-medium">{label}</label><button onClick={clear} className="text-xs text-indigo-700">Clear</button></div><canvas ref={ref} width="700" height="180" onPointerDown={start} onPointerMove={move} onPointerUp={()=>setDrawing(false)} onPointerCancel={()=>setDrawing(false)} className={`h-32 w-full touch-none rounded-lg border bg-white ${hasInk?'border-emerald-400':'border-slate-300'}`}/></div>}
function SignatureSection({record,token,done}:{record:MonitoringRecord;token:string;done:(r:MonitoringRecord)=>void}){const[harbour,setHarbour]=useState('');const[sigs,setSigs]=useState({monitoringOfficerSignature:'',supervisorSignature:'',harbourOfficerSignature:''});const[error,setError]=useState('');const[busy,setBusy]=useState(false);const submit=async()=>{setBusy(true);setError('');try{done(await wildlifeApi.sign(token,record.id,{harbourOfficerName:harbour,...sigs}))}catch(e){setError(e instanceof Error?e.message:'Signing failed')}finally{setBusy(false)}};return <div className="mt-7 space-y-5 border-t pt-6"><h3 className="font-semibold">Required Signatures</h3><SignaturePad label={`Monitoring Officer — ${record.monitoringOfficer}`} onChange={v=>setSigs(x=>({...x,monitoringOfficerSignature:v}))}/><SignaturePad label={`Supervisor — ${record.supervisor}`} onChange={v=>setSigs(x=>({...x,supervisorSignature:v}))}/><input value={harbour} onChange={e=>setHarbour(e.target.value)} placeholder="Harbour Officer name" maxLength={160} className="w-full rounded-lg border px-3 py-2.5"/><SignaturePad label="Harbour Officer" onChange={v=>setSigs(x=>({...x,harbourOfficerSignature:v}))}/>{error&&<p className="text-sm text-red-600">{error}</p>}<button disabled={busy||!harbour.trim()||Object.values(sigs).some(v=>!v)} onClick={submit} className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white disabled:opacity-40">{busy?'Saving signatures…':'Confirm All Signatures'}</button></div>}

async function loadImageAsDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load image: ${response.status}`);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function downloadWildlifeRecordPdf(record: MonitoringRecord) {
  const ownerPassword = Array.from(crypto.getRandomValues(new Uint32Array(4)))
    .map((value) => value.toString(16))
    .join('');
  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    compress: true,
    encryption: {
      userPassword: '',
      ownerPassword,
      userPermissions: ['print'],
    },
  });

  pdf.setProperties({
    title: `Wildlife Monitoring Record ${record.ticketNumber}`,
    subject: 'WWMS Wildlife Shore monitoring record',
    author: 'Whale Watching and Boat Monitoring System',
    creator: 'WWMS Wildlife Shore Portal',
  });
  pdf.setFillColor(18, 60, 50);
  pdf.rect(0, 0, 210, 34, 'F');
  try {
    const wildlifeLogo = await loadImageAsDataUrl('/WildlifeAuthority.png');
    pdf.addImage(wildlifeLogo, 'PNG', 121, 5.5, 73, 21.7, undefined, 'FAST');
  } catch {
    // Keep PDF generation available if the branding asset cannot be loaded.
  }
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('Wildlife Monitoring Record', 16, 15);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Ticket ${record.ticketNumber}`, 16, 23);
  pdf.text(`Generated ${new Date().toLocaleString('en-LK')}`, 16, 28);

  const value = (input: unknown) => {
    const text = input?.toString().trim();
    return text ? text : '-';
  };
  const field = (
    label: string,
    fieldValue: unknown,
    x: number,
    y: number,
    width = 82,
  ) => {
    pdf.setTextColor(100, 116, 139);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.text(label.toUpperCase(), x, y);
    pdf.setTextColor(20, 34, 61);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(pdf.splitTextToSize(value(fieldValue), width), x, y + 5);
  };

  field('Trip reference', record.tripId, 16, 45);
  field('Status', record.status, 112, 45);
  field('TID Number', record.tidNumber, 16, 62);
  field('Created', formatDate(record.createdAtUtc), 112, 62);
  field('Monitoring Officer', record.monitoringOfficer, 16, 79);
  field('Supervisor', record.supervisor, 112, 79);
  field('Harbour Officer', record.harbourOfficerName, 16, 96);
  field(
    'Completed',
    record.completedAtUtc ? formatDate(record.completedAtUtc) : '-',
    112,
    96,
  );

  pdf.setFillColor(232, 246, 241);
  pdf.roundedRect(16, 113, 178, 27, 3, 3, 'F');
  pdf.setTextColor(18, 60, 50);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('ATTENDANCE SNAPSHOT', 22, 121);
  pdf.setFontSize(9);
  pdf.text(`Local: ${record.local.total}`, 22, 130);
  pdf.text(`Foreign: ${record.foreign.total}`, 79, 130);
  pdf.setFontSize(14);
  pdf.text(`Total Present: ${record.totalPresent}`, 136, 130);

  const signatures: Array<[string, string | undefined]> = [
    ['Monitoring Officer', record.monitoringOfficerSignature],
    ['Supervisor', record.supervisorSignature],
    ['Harbour Officer', record.harbourOfficerSignature],
  ];
  pdf.setTextColor(20, 34, 61);
  pdf.setFontSize(10);
  pdf.text('SIGNATURES', 16, 153);
  signatures.forEach(([label, source], index) => {
    const x = 16 + index * 61;
    pdf.setDrawColor(203, 224, 216);
    pdf.roundedRect(x, 158, 56, 35, 2, 2, 'S');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.text(label, x + 3, 164);
    if (source) {
      try {
        const format = source.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        pdf.addImage(source, format, x + 3, 167, 50, 22, undefined, 'FAST');
      } catch {
        pdf.setFont('helvetica', 'normal');
        pdf.text('Signature unavailable', x + 3, 178);
      }
    } else {
      pdf.setFont('helvetica', 'normal');
      pdf.text('Not signed', x + 3, 178);
    }
  });

  pdf.setFillColor(244, 248, 246);
  pdf.roundedRect(16, 207, 178, 26, 3, 3, 'F');
  pdf.setTextColor(71, 85, 105);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.text(
    pdf.splitTextToSize(
      'This is a flattened, read-only export of the finalized WWMS Wildlife Shore monitoring record. The PDF contains no editable form fields.',
      166,
    ),
    22,
    217,
  );
  pdf.setFontSize(7.5);
  pdf.text(`Record ID: ${record.id}`, 16, 282);
  pdf.text('WWMS Wildlife Shore Portal', 194, 282, { align: 'right' });

  const safeTicket = record.ticketNumber.replace(/[<>:"/\\|?*]/g, '-');
  pdf.save(`wildlife-monitoring-${safeTicket}.pdf`);
}

export function WildlifeRecords() {
  const { session } = useAuth();
  const [rows, setRows] = useState<MonitoringRecord[]>([]);
  const [open, setOpen] = useState<string>();

  useEffect(() => {
    if (session) wildlifeApi.records(session.accessToken).then(setRows);
  }, [session]);

  return (
    <Shell
      title="Monitoring Records"
      sub="View and download finalized attendance snapshots"
    >
      <div className="space-y-3">
        {rows.map((record) => {
          const expanded = open === record.id;
          return (
            <section key={record.id} className="rounded-xl bg-white shadow-sm">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? undefined : record.id)}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-4 p-5 text-left"
              >
                <div>
                  <b>{record.ticketNumber}</b>
                  <p className="text-xs text-slate-500">
                    Trip {record.tripId.slice(0, 8)} · {record.totalPresent}{' '}
                    present · {formatDate(record.createdAtUtc)}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-indigo-700">
                  {expanded ? 'Hide' : 'View'}
                  {expanded ? (
                    <ChevronUp size={18} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={18} aria-hidden="true" />
                  )}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    key="record-details"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: 0.2 },
                    }}
                    className="overflow-hidden"
                  >
                    <div className="border-t p-5">
                  <dl className="grid gap-4 text-sm sm:grid-cols-3">
                    <Info l="TID" v={record.tidNumber} />
                    <Info l="Monitoring Officer" v={record.monitoringOfficer} />
                    <Info l="Supervisor" v={record.supervisor} />
                    <Info
                      l="Harbour Officer"
                      v={record.harbourOfficerName ?? '—'}
                    />
                    <Info l="Local snapshot" v={String(record.local.total)} />
                    <Info
                      l="Foreign snapshot"
                      v={String(record.foreign.total)}
                    />
                  </dl>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[
                      [record.monitoringOfficerSignature, 'Monitoring Officer'],
                      [record.supervisorSignature, 'Supervisor'],
                      [record.harbourOfficerSignature, 'Harbour Officer'],
                    ].map(([source, label]) => (
                      <div key={label} className="rounded-lg border p-3">
                        <p className="text-xs font-medium">{label}</p>
                        {source ? (
                          <img
                            src={source}
                            alt={`${label} signature`}
                            className="mt-2 h-20 w-full object-contain"
                          />
                        ) : (
                          <p className="mt-2 text-xs text-slate-400">
                            Not signed
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadWildlifeRecordPdf(record)}
                    className="mt-5 rounded-lg bg-[#14223d] px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Download Record
                  </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
function Info({l,v}:{l:string;v:string}){return <div><dt className="text-xs uppercase text-slate-400">{l}</dt><dd className="mt-1 break-words font-semibold">{v}</dd></div>}

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatTripDate, operationsApi } from "../../operations/operationsApi";
import { useOperations } from "../../operations/useOperations";
import PassengerAttendancePanel from "./PassengerAttendancePanel";

const ShoreTripInfo = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { trips, boats, token, reload, loading } = useOperations();
  const trip = trips.find(item => item.id === tripId);
  const boat = boats.find(item => item.id === trip?.boatId);
  const [result, setResult] = useState<"started" | "declined" | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const decide = async (decision: "started" | "declined") => {
    if (!trip || !token || busy) return;
    const override = trip.status === "NeedsReschedule";
    if (decision === "started" && override && !window.confirm("This trip is marked as needing rescheduling. Are you sure you want to override this status and start the trip?")) return;
    const reason = decision === "declined" ? window.prompt("Reason for declining this trip (optional):") : undefined;
    if (decision === "declined" && reason === null) return;
    setBusy(true); setActionError("");
    try {
      if (decision === "started") await operationsApi.startTrip(token, trip.id, override);
      else await operationsApi.declineTrip(token, trip.id, reason || undefined);
      setResult(decision); await reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update this trip.");
    } finally { setBusy(false); }
  };

  if (loading) return <main className="p-10 text-center">Loading…</main>;
  if (!trip) return <main className="p-10 text-center"><p>Trip not found.</p><button onClick={()=>navigate('/shore/trips')} className="mt-4 text-indigo-700">Back to trips</button></main>;
  const actionable = ["Scheduled", "Boarding", "NeedsReschedule"].includes(trip.status);

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <aside className="overflow-hidden rounded-xl bg-white shadow-sm"><img src="/gallery-2.jpg" alt="Whale watching vessel at sea" className="h-52 w-full object-cover"/><div className="p-6"><h1 className="text-2xl font-semibold text-[#14223d]">{trip.vesselName}</h1><p className="mt-1 text-xs text-slate-400">{trip.registrationNumber}</p><dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 text-xs"><Detail label="Owner" value={trip.ownerName}/><Detail label="Departure" value={formatTripDate(trip.scheduledDepartureUtc)}/><Detail label="Length" value={`${boat?.lengthMeters ?? 0} M`}/><Detail label="Capacity" value={`${boat?.maximumCapacity ?? trip.passengerCount} Passengers`}/><Detail label="Passengers" value={`${trip.passengerCount}`}/><Detail label="Status" value={trip.status}/></dl></div></aside>
      <div className="grid gap-5">
        {token&&tripId&&<PassengerAttendancePanel token={token} tripId={tripId}/>}
        <div className="grid gap-5 lg:grid-cols-[1fr_270px]">
          <DataCard title={`Crew (${trip.crew.length})`} columns={["Name","NIC","Role","Certified"]} rows={trip.crew.map(member=>[member.name,member.nicNumber||"Not provided",member.position,member.certified?"Yes":"No"])} emptyText="No crew assigned to this trip."/>
          <section className="rounded-xl bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold text-[#14223d]">Trip departure</h2><p className="mt-3 text-xs leading-5 text-slate-500">Start after passenger confirmation is finalized. Wildlife monitoring does not authorize departure.</p>{trip.status==='NeedsReschedule'&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-800">Starting this trip records a Shore Officer reschedule override.</p>}{!trip.passengerVerificationFinalizedAtUtc&&<p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Passenger confirmation has not been finalized.</p>}<div className="mt-6 grid gap-3"><button type="button" disabled={busy||!actionable||!trip.passengerVerificationFinalizedAtUtc} onClick={()=>void decide("started")} className="rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy?"Working…":trip.status==='NeedsReschedule'?"Start Anyway":"Start Trip"}</button><button type="button" disabled={busy||!actionable} onClick={()=>void decide("declined")} className="rounded-md bg-red-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Decline Trip</button></div>{actionError&&<p role="alert" className="mt-3 text-xs font-medium text-red-600">{actionError}</p>}</section>
        </div>
      </div>
    </div>
    {result&&<DecisionDialog decision={result} onClose={()=>setResult(null)}/>}
  </main>;
};

function Detail({label,value}:{label:string;value:string}) { return <div><dt className="text-slate-400">{label}</dt><dd className="mt-1 font-medium text-[#14223d]">{value}</dd></div>; }
function DataCard({title,columns,rows,emptyText}:{title:string;columns:string[];rows:string[][];emptyText:string}) { const [search,setSearch]=useState(""); const visible=useMemo(()=>{const query=search.trim().toLowerCase();return query?rows.filter(row=>row.some(value=>value.toLowerCase().includes(query))):rows},[rows,search]); return <section className="overflow-hidden rounded-xl bg-white shadow-sm"><div className="flex items-center justify-between border-b px-6 py-5"><h2 className="text-lg font-semibold">{title}</h2><input aria-label={`Search ${title}`} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search" className="w-36 rounded-md border px-3 py-2 text-xs"/></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-slate-50"><tr>{columns.map(column=><th key={column} className="px-6 py-3">{column}</th>)}</tr></thead><tbody className="divide-y">{visible.map((row,index)=><tr key={index}>{row.map((value,cell)=><td key={cell} className="px-6 py-4 text-slate-600">{value}</td>)}</tr>)}</tbody></table>{visible.length===0&&<p className="px-6 py-8 text-center text-xs text-slate-400">{emptyText}</p>}</div></section>; }
function DecisionDialog({decision,onClose}:{decision:"started"|"declined";onClose:()=>void}) { const started=decision==="started"; return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" onMouseDown={onClose}><section role="dialog" aria-modal="true" onMouseDown={event=>event.stopPropagation()} className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-2xl"><div className={`mx-auto grid h-12 w-12 place-items-center rounded-full text-2xl font-bold text-white ${started?"bg-emerald-500":"bg-red-500"}`}>{started?"✓":"!"}</div><h2 className="mt-5 text-lg font-semibold">Trip {started?"started successfully":"declined"}</h2><p className="mt-3 text-xs text-slate-500">{started?"The trip is ongoing and its server start time was recorded.":"The trip remains stored with its decline audit history."}</p><button onClick={onClose} className={`mt-7 w-full rounded-md px-4 py-3 text-sm font-semibold text-white ${started?"bg-emerald-500":"bg-red-500"}`}>Continue</button></section></div>; }

export default ShoreTripInfo;

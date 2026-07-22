import { useEffect, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { connectOperations, operationsApi, type TransferHistory } from "../../../operations/operationsApi";

export default function TransferHistoryPanel({tripId}:{tripId:string}){
 const{session}=useAuth();const[records,setRecords]=useState<TransferHistory[]>([]);
 useEffect(()=>{if(!session)return;let active=true;const load=()=>void operationsApi.transferHistory(session.accessToken).then(items=>{if(active)setRecords(items.filter(item=>item.sourceTripId===tripId||item.destinationTripId===tripId))}).catch(()=>undefined);load();const disconnect=connectOperations(session.accessToken,load);return()=>{active=false;disconnect()}},[session,tripId]);
 if(!records.length)return null;
 return <section className="mt-4 rounded-xl bg-white p-5 shadow-sm"><h2 className="font-bold">Transfer History</h2><div className="mt-4 space-y-3">{records.map(record=><article key={record.id} className="rounded-lg border p-4 text-xs"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{record.sourceBoat} → {record.destinationBoat}</p><p className="mt-1 text-slate-500">{record.sourceRegistrationNumber} / Trip {record.sourceTripId} → {record.destinationRegistrationNumber} / Trip {record.destinationTripId}</p><p className="mt-1 text-slate-500">Owners: {record.sourceOwner} → {record.destinationOwner}</p></div><time className="text-slate-500">{new Intl.DateTimeFormat("en-LK",{dateStyle:"medium",timeStyle:"short"}).format(new Date(record.transferredAtUtc))}</time></div><p className="mt-3">{record.items.map(item=>`${item.personName} (${item.personType})`).join(", ")}</p><p className="mt-2 text-slate-500">By {record.initiatedBy} · {record.reason}{record.explanation?` — ${record.explanation}`:""} · {record.status}</p></article>)}</div></section>;
}

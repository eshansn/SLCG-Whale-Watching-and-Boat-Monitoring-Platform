import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { boats as seedBoats, crew as seedCrew, owners as seedOwners } from "./adminData";
import type { ApprovalStatus, BoatRecord, CrewRecord, OwnerRecord } from "./adminData";

interface RecordsState { boats: BoatRecord[]; crew: CrewRecord[]; owners: OwnerRecord[] }
interface RecordsContextValue extends RecordsState {
  updateBoat: (id: number, values: Partial<BoatRecord>) => void; updateCrew: (id: number, values: Partial<CrewRecord>) => void; updateOwner: (id: number, values: Partial<OwnerRecord>) => void;
  setBoatApproval: (id: number, status: ApprovalStatus, reason?: string) => void; setCrewApproval: (id: number, status: ApprovalStatus, reason?: string) => void;
  deleteBoat: (id: number) => void; deleteCrew: (id: number) => void; deleteOwner: (id: number) => boolean;
}
const STORAGE_KEY = "admin-records-v1"; const initial: RecordsState = { boats: seedBoats, crew: seedCrew, owners: seedOwners }; const Context = createContext<RecordsContextValue | null>(null);
export function AdminRecordsProvider({ children }: { children: ReactNode }) {
 const [state,setState]=useState<RecordsState>(()=>{try{const saved=localStorage.getItem(STORAGE_KEY);return saved?JSON.parse(saved) as RecordsState:initial}catch{return initial}});
 useEffect(()=>localStorage.setItem(STORAGE_KEY,JSON.stringify(state)),[state]);
 const patch=<K extends keyof RecordsState>(key:K,id:number,values:Partial<RecordsState[K][number]>)=>setState(s=>({...s,[key]:s[key].map(item=>item.id===id?{...item,...values}:item)}));
 const value:RecordsContextValue={...state,updateBoat:(id,v)=>patch("boats",id,v),updateCrew:(id,v)=>patch("crew",id,v),updateOwner:(id,v)=>patch("owners",id,v),setBoatApproval:(id,approval,declineReason)=>patch("boats",id,{approval,declineReason:approval==="Declined"?declineReason:undefined}),setCrewApproval:(id,approval,declineReason)=>patch("crew",id,{approval,declineReason:approval==="Declined"?declineReason:undefined}),deleteBoat:id=>setState(s=>({...s,boats:s.boats.filter(b=>b.id!==id),owners:s.owners.map(o=>({...o,boatIds:o.boatIds.filter(x=>x!==id)})),crew:s.crew.map(c=>c.boatId===id?{...c,boatId:undefined}:c)})),deleteCrew:id=>setState(s=>({...s,crew:s.crew.filter(c=>c.id!==id),boats:s.boats.map(b=>({...b,crewIds:b.crewIds.filter(x=>x!==id)}))})),deleteOwner:id=>{if(state.boats.some(b=>b.ownerId===id))return false;setState(s=>({...s,owners:s.owners.filter(o=>o.id!==id)}));return true;}};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAdminRecords(){const value=useContext(Context);if(!value)throw new Error("Admin records provider is missing");return value;}

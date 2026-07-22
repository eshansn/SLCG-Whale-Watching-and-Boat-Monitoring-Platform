import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ApprovalStatus, BoatRecord, CrewRecord, OwnerRecord } from "./adminData";
import { useAuth } from "../../auth/useAuth";
import { connectOperations, operationsApi } from "../../operations/operationsApi";

interface RecordsState { boats: BoatRecord[]; crew: CrewRecord[]; owners: OwnerRecord[] }
interface RecordsContextValue extends RecordsState {
  updateBoat: (id: number, values: Partial<BoatRecord>) => void; updateCrew: (id: number, values: Partial<CrewRecord>) => void; updateOwner: (id: number, values: Partial<OwnerRecord>) => void;
  setBoatApproval: (id: number, status: ApprovalStatus, reason?: string) => void; setCrewApproval: (id: number, status: ApprovalStatus, reason?: string) => void;
  deleteBoat: (id: number) => void; deleteCrew: (id: number) => void; deleteOwner: (id: number) => boolean;
}
const initial: RecordsState = { boats: [], crew: [], owners: [] }; const Context = createContext<RecordsContextValue | null>(null);
export function AdminRecordsProvider({ children }: { children: ReactNode }) {
 const {session}=useAuth();
 const [state,setState]=useState<RecordsState>(initial);
 useEffect(()=>{
  if(!session || !session.roles.some(role=>role==="Admin"||role==="Wildlife"))return;
  let active=true;
  const load=()=>void Promise.all([operationsApi.boats(session.accessToken),operationsApi.trips(session.accessToken),operationsApi.directory(session.accessToken)]).then(([apiBoats,apiTrips,directory])=>{
   if(!active)return;
   const ownerIds=new Map(directory.owners.map((owner,index)=>[owner.id,index+1]));
   const boatIds=new Map(apiBoats.map((boat,index)=>[boat.id,index+1]));
   const tripIds=new Map(apiTrips.map((trip,index)=>[trip.id,index+101]));
   const crewIds=new Map(directory.crew.map((member,index)=>[member.id,index+1]));
   const owners:OwnerRecord[]=directory.owners.map(owner=>({id:ownerIds.get(owner.id)!,apiId:owner.id,name:owner.displayName,nic:owner.nicNumber??"",email:owner.email,phone:owner.phoneNumber??"",address:owner.bio??"",boatIds:apiBoats.filter(boat=>boat.ownerId===owner.id).map(boat=>boatIds.get(boat.id)!)}));
   const boats:BoatRecord[]=apiBoats.map(boat=>({id:boatIds.get(boat.id)!,apiId:boat.id,imageUrl:boat.imageUrl,documents:boat.documents,name:boat.name,registrationNumber:boat.registrationNumber,registrationDate:boat.registrationDate,hullNumber:boat.hullNumber,length:`${boat.lengthMeters} m`,width:`${boat.widthMeters} m`,capacity:boat.maximumCapacity,ownerId:ownerIds.get(boat.ownerId)!,crewIds:directory.crew.filter(member=>member.boatId===boat.id).map(member=>crewIds.get(member.id)!),approval:boat.approval==="Rejected"?"Declined":boat.approval as ApprovalStatus,certifications:boat.documents.map(document=>document.name),tripIds:apiTrips.filter(trip=>trip.boatId===boat.id).map(trip=>tripIds.get(trip.id)!)}));
   const crew:CrewRecord[]=directory.crew.map(member=>({id:crewIds.get(member.id)!,apiId:member.id,ownerId:ownerIds.get(member.ownerId),name:member.displayName,nic:member.nicNumber??"",email:member.email,phone:member.phoneNumber??"",address:"",role:member.position as CrewRecord["role"],boatId:member.boatId?boatIds.get(member.boatId):undefined,approval:member.certified?"Approved":"Pending",certifications:member.certified?["Certified crew account"]:[],tripIds:apiTrips.filter(trip=>trip.crew.some(assignment=>assignment.crewUserId===member.id)).map(trip=>tripIds.get(trip.id)!)}));
   setState({owners,boats,crew});
  }).catch(()=>undefined);load();const disconnect=connectOperations(session.accessToken,load);
  return()=>{active=false;disconnect()};
 },[session]);
 const patch=<K extends keyof RecordsState>(key:K,id:number,values:Partial<RecordsState[K][number]>)=>setState(s=>({...s,[key]:s[key].map(item=>item.id===id?{...item,...values}:item)}));
 const value:RecordsContextValue={...state,updateBoat:(id,v)=>patch("boats",id,v),updateCrew:(id,v)=>patch("crew",id,v),updateOwner:(id,v)=>patch("owners",id,v),setBoatApproval:(id,approval,declineReason)=>{patch("boats",id,{approval,declineReason:approval==="Declined"?declineReason:undefined});const boat=state.boats.find(x=>x.id===id);if(boat?.apiId&&session)void operationsApi.approveBoat(session.accessToken,boat.apiId,approval==="Approved"?"Approved":"Rejected",declineReason)},setCrewApproval:(id,approval,declineReason)=>{patch("crew",id,{approval,declineReason:approval==="Declined"?declineReason:undefined});const member=state.crew.find(x=>x.id===id);if(member?.apiId&&session)void operationsApi.approveCrew(session.accessToken,member.apiId,approval==="Approved"?"Approved":"Rejected",declineReason)},deleteBoat:id=>setState(s=>({...s,boats:s.boats.filter(b=>b.id!==id),owners:s.owners.map(o=>({...o,boatIds:o.boatIds.filter(x=>x!==id)})),crew:s.crew.map(c=>c.boatId===id?{...c,boatId:undefined}:c)})),deleteCrew:id=>setState(s=>({...s,crew:s.crew.filter(c=>c.id!==id),boats:s.boats.map(b=>({...b,crewIds:b.crewIds.filter(x=>x!==id)}))})),deleteOwner:id=>{if(state.boats.some(b=>b.ownerId===id))return false;setState(s=>({...s,owners:s.owners.filter(o=>o.id!==id)}));return true;}};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAdminRecords(){const value=useContext(Context);if(!value)throw new Error("Admin records provider is missing");return value;}

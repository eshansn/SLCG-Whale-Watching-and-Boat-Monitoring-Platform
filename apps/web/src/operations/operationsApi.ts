import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export interface Boat { id:string; ownerId:string; ownerName:string; name:string; registrationNumber:string; registrationDate:string; hullNumber:string; lengthMeters:number; widthMeters:number; maximumCapacity:number; approval:string; imageUrl?:string }
export interface Trip { id:string; boatId:string; vesselName:string; registrationNumber:string; ownerName:string; scheduledDepartureUtc:string; actualDepartureUtc?:string; actualArrivalUtc?:string; route:string; passengerCount:number; status:string; shoreApproval:string; shoreNotes?:string; updatedAtUtc:string }

async function request<T>(path:string, token:string, init?:RequestInit):Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`, ...init?.headers} });
  if (!response.ok) throw new Error(response.status === 403 ? 'You are not permitted to perform this action.' : `Request failed (${response.status}).`);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export const operationsApi = {
  boats:(token:string)=>request<Boat[]>('/api/operations/boats',token),
  trips:(token:string)=>request<Trip[]>('/api/operations/trips',token),
  approve:(token:string,id:string,approval:'Approved'|'Rejected',notes?:string)=>request<void>(`/api/operations/trips/${id}/shore-approval`,token,{method:'PATCH',body:JSON.stringify({approval,notes})}),
  status:(token:string,id:string,status:string)=>request<void>(`/api/operations/trips/${id}/status`,token,{method:'PATCH',body:JSON.stringify({status})}),
};
export function connectOperations(token:string,onChange:()=>void) {
  const connection = new HubConnectionBuilder().withUrl(`${API_BASE_URL}/hubs/operations`,{accessTokenFactory:()=>token}).withAutomaticReconnect().configureLogging(LogLevel.Warning).build();
  connection.on('operationsChanged',onChange); connection.start().catch(console.error);
  return ()=>{ void connection.stop(); };
}
export const formatTripDate=(value:string)=>new Intl.DateTimeFormat('en-LK',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));

import { HubConnectionBuilder } from '@microsoft/signalr';
const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
const CONNECTION_RETRY_DELAYS_MS=[1000,5000,10000,30000] as const;
export interface Count{adult:number;child:number;small:number;total:number}
export interface WildlifeTrip{id:string;boatName:string;registrationNumber:string;ownerName:string;scheduledDepartureUtc:string;route:string;status:string;registeredPassengers:number;shoreApproval:string;wildlifeShoreApproval:string;certificationApproval:string;boatWildlifeApproval:string}
export interface Attendance{tripId:string;boatName:string;registrationNumber:string;ownerName:string;scheduledDepartureUtc:string;route:string;tripStatus:string;shoreApproval:string;wildlifeShoreApproval:string;certificationApproval:string;boatWildlifeApproval:string;local:Count;foreign:Count;totalPresent:number;lastUpdatedUtc:string}
export interface MonitoringRecord{id:string;tripId:string;ticketNumber:string;tidNumber:string;monitoringOfficer:string;supervisor:string;status:string;local:Count;foreign:Count;totalPresent:number;harbourOfficerName?:string;signedAtUtc?:string;createdAtUtc:string;completedAtUtc?:string;monitoringOfficerSignature?:string;supervisorSignature?:string;harbourOfficerSignature?:string}
async function req<T>(token:string,path:string,init?:RequestInit):Promise<T>{const r=await fetch(`${BASE}${path}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init?.headers}});if(!r.ok){const p=await r.json().catch(()=>null) as {message?:string;title?:string}|null;throw new Error(p?.message??p?.title??`Request failed (${r.status})`)}return r.json() as Promise<T>}
export const wildlifeApi={trips:(t:string)=>req<WildlifeTrip[]>(t,'/api/shore-wildlife/trips'),attendance:(t:string,id:string)=>req<Attendance>(t,`/api/shore-wildlife/trips/${id}/attendance`),records:(t:string)=>req<MonitoringRecord[]>(t,'/api/shore-wildlife/records'),record:(t:string,id:string)=>req<MonitoringRecord>(t,`/api/shore-wildlife/records/${id}`),create:(t:string,x:{tripId:string;ticketNumber:string;tidNumber:string;monitoringOfficer:string;supervisor:string})=>req<MonitoringRecord>(t,'/api/shore-wildlife/records',{method:'POST',body:JSON.stringify(x)}),requestSignature:(t:string,id:string,x:{ticketNumber:string;tidNumber:string;monitoringOfficer:string;supervisor:string})=>req<MonitoringRecord>(t,`/api/shore-wildlife/records/${id}`,{method:'PUT',body:JSON.stringify(x)}),sign:(t:string,id:string,x:{harbourOfficerName:string;monitoringOfficerSignature:string;supervisorSignature:string;harbourOfficerSignature:string})=>req<MonitoringRecord>(t,`/api/shore-wildlife/records/${id}/sign`,{method:'POST',body:JSON.stringify(x)}),approve:(t:string,tripId:string,approval:'Approved'|'Rejected',notes?:string)=>req<WildlifeTrip>(t,`/api/shore-wildlife/trips/${tripId}/approval`,{method:'PATCH',body:JSON.stringify({approval,notes})})};
export function watchAttendance(token:string,onChange:()=>void){
 const connection=new HubConnectionBuilder().withUrl(`${BASE}/hubs/operations`,{accessTokenFactory:()=>token}).withAutomaticReconnect().build();
 let disposed=false;
 let refreshAfterStart=false;
 let retryAttempt=0;
 let retryTimer:number|undefined;
 const notifyChange=()=>{if(disposed)return;try{onChange()}catch(error){console.error('Unable to refresh Wildlife attendance after reconnecting.',error)}};
 const scheduleRetry=(error?:unknown)=>{
  if(disposed||retryTimer!==undefined)return;
  refreshAfterStart=true;
  const delay=CONNECTION_RETRY_DELAYS_MS[Math.min(retryAttempt,CONNECTION_RETRY_DELAYS_MS.length-1)];
  retryAttempt+=1;
  console.error(`Unable to connect to live Wildlife attendance. Retrying in ${delay/1000} seconds.`,error);
  retryTimer=window.setTimeout(()=>{retryTimer=undefined;void start()},delay);
 };
 const start=async()=>{
  try{await connection.start()}catch(error){scheduleRetry(error);return}
  if(disposed){void connection.stop();return}
  retryAttempt=0;
  if(refreshAfterStart)notifyChange();
  refreshAfterStart=false;
 };
 connection.on('operationsChanged',(event:{entity?:string})=>{if(event?.entity?.startsWith('passengerAttendance'))notifyChange()});
 connection.onreconnected(notifyChange);
 connection.onclose(scheduleRetry);
 void start();
 return()=>{disposed=true;if(retryTimer!==undefined)window.clearTimeout(retryTimer);void connection.stop()};
}

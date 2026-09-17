import { HubConnectionBuilder } from '@microsoft/signalr';
import { API_BASE_URL as BASE } from '../../api/httpClient';
const CONNECTION_RETRY_DELAYS_MS=[1000,5000,10000,30000] as const;
export interface Count{adult:number;child:number;small:number;total:number}
export interface WildlifeTrip{id:string;boatName:string;registrationNumber:string;ownerName:string;scheduledDepartureUtc:string;route:string;status:string;registeredPassengers:number;monitoringStatus:string}
export interface Attendance{tripId:string;boatName:string;registrationNumber:string;ownerName:string;scheduledDepartureUtc:string;route:string;tripStatus:string;local:Count;foreign:Count;totalPresent:number;lastUpdatedUtc:string}
export type SignatureType='Supervisor'|'HarbourOfficer';
export type SignatureRequestStatus='Pending'|'Signed'|'Declined'|'Cancelled'|'Superseded';
export interface SignatureUser{id:string;fullName:string;username:string;email:string;role:SignatureType}
export interface RecordSignatureRequest{id:string;wildlifeMonitoringRecordId:string;signatureType:SignatureType;status:SignatureRequestStatus;requestedUserId:string;requestedUserFullName:string;requestedUsername:string;requestedUserEmail:string;requestedByName:string;requestedAtUtc:string;signedAtUtc?:string;declinedAtUtc?:string;declineReason?:string;signatureData?:string}
export interface MonitoringRecord{id:string;tripId:string;boatName:string;registrationNumber:string;scheduledDepartureUtc:string;ticketNumber:string;tidNumber:string;monitoringOfficer:string;supervisor:string;status:string;local:Count;foreign:Count;totalPresent:number;harbourOfficerName?:string;signedAtUtc?:string;createdAtUtc:string;completedAtUtc?:string;monitoringOfficerSignature?:string;supervisorSignature?:string;harbourOfficerSignature?:string;usesSignatureRequestWorkflow:boolean;monitoringOfficerSignedAtUtc?:string;supervisorRequest?:RecordSignatureRequest;harbourOfficerRequest?:RecordSignatureRequest}
async function req<T>(token:string,path:string,init?:RequestInit):Promise<T>{const r=await fetch(`${BASE}${path}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init?.headers}});if(!r.ok){const p=await r.json().catch(()=>null) as {message?:string;detail?:string;title?:string;errors?:Record<string,string[]>}|null;const validation=p?.errors?Object.values(p.errors).flat()[0]:undefined;throw new Error(p?.message??validation??p?.detail??p?.title??`Request failed (${r.status})`)}return r.status===204?undefined as T:r.json() as Promise<T>}
export const wildlifeApi={trips:(t:string)=>req<WildlifeTrip[]>(t,'/api/shore-wildlife/trips'),attendance:(t:string,id:string)=>req<Attendance>(t,`/api/shore-wildlife/trips/${id}/attendance`),records:(t:string)=>req<MonitoringRecord[]>(t,'/api/shore-wildlife/records'),record:(t:string,id:string)=>req<MonitoringRecord>(t,`/api/shore-wildlife/records/${id}`),create:(t:string,x:{tripId:string;ticketNumber:string;tidNumber:string;monitoringOfficer:string;supervisor?:string})=>req<MonitoringRecord>(t,'/api/shore-wildlife/records',{method:'POST',body:JSON.stringify(x)}),requestSignature:(t:string,id:string,x:{ticketNumber:string;tidNumber:string;monitoringOfficer:string;supervisor?:string})=>req<MonitoringRecord>(t,`/api/shore-wildlife/records/${id}`,{method:'PUT',body:JSON.stringify(x)}),sign:(t:string,id:string,x:{monitoringOfficerSignature:string;harbourOfficerName?:string;supervisorSignature?:string;harbourOfficerSignature?:string})=>req<MonitoringRecord>(t,`/api/shore-wildlife/records/${id}/sign`,{method:'POST',body:JSON.stringify(x)}),searchSignatureUsers:(t:string,role:SignatureType,q:string)=>req<SignatureUser[]>(t,`/api/shore-wildlife/signature-users/search?role=${encodeURIComponent(role)}&q=${encodeURIComponent(q)}`),requestExternalSignature:(t:string,id:string,signatureType:SignatureType,requestedUserId:string)=>req<RecordSignatureRequest>(t,`/api/shore-wildlife/records/${id}/signature-requests`,{method:'POST',body:JSON.stringify({signatureType,requestedUserId})}),confirm:(t:string,id:string)=>req<MonitoringRecord>(t,`/api/shore-wildlife/records/${id}/confirm`,{method:'POST',body:'{}'}),discard:(t:string,id:string)=>req<MonitoringRecord>(t,`/api/shore-wildlife/records/${id}/discard`,{method:'POST',body:'{}'})};
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
 connection.on('wildlifeRecordChanged',notifyChange);
 connection.on('signatureRequestChanged',notifyChange);
 connection.onreconnected(notifyChange);
 connection.onclose(scheduleRetry);
 void start();
 return()=>{disposed=true;if(retryTimer!==undefined)window.clearTimeout(retryTimer);void connection.stop()};
}

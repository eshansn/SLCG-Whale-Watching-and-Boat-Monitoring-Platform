import { API_BASE_URL } from '../../api/httpClient';
import type { TripPassenger } from '../../operations/operationsApi';

export type AttendanceStatus='NotChecked'|'Present'|'NotPresent';
export interface AttendanceSummary{present:number;notPresent:number;notChecked:number;total:number}
export interface AttendancePassenger{passengerId:string;name:string;passengerReference:string;phoneNumber:string;relationship:string;status:AttendanceStatus;checkedAtUtc?:string;updatedAtUtc?:string;passengerType?:string;countryCode?:string;ageCategory?:string}
export interface AttendanceManifest{tripId:string;boatName:string;registrationNumber:string;scheduledDepartureUtc:string;tripStatus:string;finalizedAtUtc?:string;finalizedBy?:string;summary:AttendanceSummary;passengers:AttendancePassenger[]}
export interface PassengerGroup{primaryPassengerId:string;primaryPassengerName:string;primaryPassengerReference:string;tripId:string;boatName:string;registrationNumber:string;scheduledDepartureUtc:string;alreadyProcessed:boolean;finalized:boolean;members:AttendancePassenger[]}
export interface PassengerGroupSearch{primaryPassengerId:string;primaryPassengerName:string;passengerReference:string;memberCount:number;alreadyProcessed:boolean}

async function request<T>(token:string,path:string,init?:RequestInit):Promise<T>{
 const response=await fetch(`${API_BASE_URL}${path}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init?.headers}});
 if(!response.ok){const problem=await response.json().catch(()=>null) as {message?:string;detail?:string;title?:string;errors?:Record<string,string[]>}|null;const validation=problem?.errors?Object.values(problem.errors).flat()[0]:undefined;throw new Error(problem?.message??validation??problem?.detail??problem?.title??`Request failed (${response.status}).`)}
 return response.json() as Promise<T>;
}

async function loadManifest(token: string, tripId: string): Promise<AttendanceManifest> {
 // These existing read endpoints expose attendance and nationality/age respectively.
 // Publish one joined snapshot, and retry a concurrent booking/transfer once rather
 // than silently dropping passengers or mixing lists with different membership.
 for (let attempt = 0; attempt < 2; attempt++) {
  const [manifest, passengers] = await Promise.all([
   request<AttendanceManifest>(token, `/api/shore/trips/${tripId}/attendance`, { cache: 'no-store' }),
   request<TripPassenger[]>(token, `/api/operations/trips/${tripId}/passengers`, { cache: 'no-store' }),
  ]);
  const metadata = new Map(passengers.map(person => [person.id, person]));
  if (manifest.tripId !== tripId) throw new Error('The passenger manifest does not match this trip.');
  if (metadata.size !== manifest.passengers.length || manifest.passengers.some(person => !metadata.has(person.passengerId))) continue;
  return { ...manifest, passengers: manifest.passengers.map(person => {
   const details = metadata.get(person.passengerId)!;
   return { ...person, name: details.name, passengerType: details.passengerType, countryCode: details.countryCode, ageCategory: details.ageCategory };
  }) };
 }
 throw new Error('Passenger registrations changed while loading. Refresh attendance to retrieve the current list.');
}

export const shoreAttendanceApi={
 manifest:loadManifest,
 scan:(token:string,tripId:string,qrValue:string)=>request<PassengerGroup>(token,`/api/shore/trips/${tripId}/attendance/scan`,{method:'POST',body:JSON.stringify({qrValue})}),
 group:(token:string,tripId:string,primaryId:string)=>request<PassengerGroup>(token,`/api/shore/trips/${tripId}/attendance/groups/${primaryId}`),
 search:(token:string,tripId:string,query:string,signal?:AbortSignal)=>request<PassengerGroupSearch[]>(token,`/api/shore/trips/${tripId}/attendance/search?query=${encodeURIComponent(query)}`,{signal}),
 saveGroup:(token:string,tripId:string,primaryId:string,items:{passengerId:string;status:AttendanceStatus}[])=>request<PassengerGroup>(token,`/api/shore/trips/${tripId}/attendance/groups/${primaryId}`,{method:'PUT',body:JSON.stringify({items})}),
 finalize:(token:string,tripId:string,confirmIncomplete:boolean)=>request<AttendanceManifest>(token,`/api/shore/trips/${tripId}/attendance/finalize`,{method:'POST',body:JSON.stringify({confirmIncomplete})}),
};

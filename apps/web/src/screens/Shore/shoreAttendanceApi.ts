const API_BASE_URL=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');

export type AttendanceStatus='NotChecked'|'Present'|'NotPresent';
export interface AttendanceSummary{present:number;notPresent:number;notChecked:number;total:number}
export interface AttendancePassenger{passengerId:string;name:string;passengerReference:string;phoneNumber:string;relationship:string;status:AttendanceStatus;checkedAtUtc?:string;updatedAtUtc?:string}
export interface AttendanceManifest{tripId:string;boatName:string;registrationNumber:string;scheduledDepartureUtc:string;tripStatus:string;finalizedAtUtc?:string;finalizedBy?:string;summary:AttendanceSummary;passengers:AttendancePassenger[]}
export interface PassengerGroup{primaryPassengerId:string;primaryPassengerName:string;primaryPassengerReference:string;tripId:string;boatName:string;registrationNumber:string;scheduledDepartureUtc:string;alreadyProcessed:boolean;finalized:boolean;members:AttendancePassenger[]}
export interface PassengerGroupSearch{primaryPassengerId:string;primaryPassengerName:string;passengerReference:string;memberCount:number;alreadyProcessed:boolean}

async function request<T>(token:string,path:string,init?:RequestInit):Promise<T>{
 const response=await fetch(`${API_BASE_URL}${path}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init?.headers}});
 if(!response.ok){const problem=await response.json().catch(()=>null) as {message?:string;detail?:string;title?:string;errors?:Record<string,string[]>}|null;const validation=problem?.errors?Object.values(problem.errors).flat()[0]:undefined;throw new Error(problem?.message??validation??problem?.detail??problem?.title??`Request failed (${response.status}).`)}
 return response.json() as Promise<T>;
}

export const shoreAttendanceApi={
 manifest:(token:string,tripId:string)=>request<AttendanceManifest>(token,`/api/shore/trips/${tripId}/attendance`),
 scan:(token:string,tripId:string,qrValue:string)=>request<PassengerGroup>(token,`/api/shore/trips/${tripId}/attendance/scan`,{method:'POST',body:JSON.stringify({qrValue})}),
 group:(token:string,tripId:string,primaryId:string)=>request<PassengerGroup>(token,`/api/shore/trips/${tripId}/attendance/groups/${primaryId}`),
 search:(token:string,tripId:string,query:string)=>request<PassengerGroupSearch[]>(token,`/api/shore/trips/${tripId}/attendance/search?query=${encodeURIComponent(query)}`),
 saveGroup:(token:string,tripId:string,primaryId:string,items:{passengerId:string;status:AttendanceStatus}[])=>request<PassengerGroup>(token,`/api/shore/trips/${tripId}/attendance/groups/${primaryId}`,{method:'PUT',body:JSON.stringify({items})}),
 finalize:(token:string,tripId:string,confirmIncomplete:boolean)=>request<AttendanceManifest>(token,`/api/shore/trips/${tripId}/attendance/finalize`,{method:'POST',body:JSON.stringify({confirmIncomplete})}),
};

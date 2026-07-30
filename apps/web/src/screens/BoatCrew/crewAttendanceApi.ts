const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
export type CrewAttendanceStatus='NotChecked'|'Present'|'NotPresent';
export interface CrewAttendancePassenger{passengerId:string;status:CrewAttendanceStatus;checkedAtUtc?:string}
export interface CrewAttendanceManifest{finalizedAtUtc?:string;finalizedBy?:string;summary:{present:number;notPresent:number;notChecked:number;total:number};passengers:CrewAttendancePassenger[]}
export async function getCrewAttendance(token:string,tripId:string):Promise<CrewAttendanceManifest>{const response=await fetch(`${BASE}/api/shore/trips/${tripId}/attendance`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error(`Unable to load passenger attendance (${response.status}).`);return response.json() as Promise<CrewAttendanceManifest>}

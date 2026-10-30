import { API_BASE_URL as BASE } from '../../api/httpClient';
export interface CrewProfile { id:string; userName:string; displayName:string; nicNumber:string; email:string; phoneNumber:string; position:string; certified:boolean; hasProfilePhoto:boolean; bio?:string }
export interface CrewCertificate { id:string; name:string; contentType:string; uploadedAtUtc:string }
export const crewPositions = ['Crew Member', 'Captain', 'Coxswain', 'Life Saver', 'Deck Hand', 'Diver', 'First Aid Officer'];
async function json<T>(path:string,token:string,init?:RequestInit):Promise<T>{const r=await fetch(`${BASE}${path}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init?.headers}});if(!r.ok){const p=await r.json().catch(()=>null) as {title?:string;detail?:string;errors?:Record<string,string[]>}|null;throw new Error(p?.detail??p?.title??(p?.errors?Object.values(p.errors).flat()[0]:undefined)??`Request failed (${r.status}).`)}return r.status===204?undefined as T:r.json()}
export const crewApi={
 profile:(token:string)=>json<CrewProfile>('/api/crew/profile',token),
 update:(token:string,data:{email:string;phoneNumber:string;bio:string;displayName?:string;position?:string})=>json<CrewProfile>('/api/crew/profile',token,{method:'PATCH',body:JSON.stringify(data)}),
 certificates:(token:string)=>json<CrewCertificate[]>('/api/crew/profile/certificates',token),
 uploadCertificate:async(token:string,file:File)=>{const body=new FormData();body.append('certificate',file);const r=await fetch(`${BASE}/api/crew/profile/certificates`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});if(!r.ok){const p=await r.json().catch(()=>null);throw new Error(p?.message??p?.detail??(p?.errors?Object.values(p.errors).flat()[0]:undefined)??'Unable to upload certificate.')}return r.json() as Promise<CrewCertificate>},
 downloadCertificate:async(token:string,id:string)=>{const r=await fetch(`${BASE}/api/crew/profile/certificates/${id}`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Unable to download certificate.');return r.blob()},
 photo:async(token:string)=>{const r=await fetch(`${BASE}/api/crew/profile/photo`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Unable to load profile photo.');return URL.createObjectURL(await r.blob())},
 uploadPhoto:async(token:string,photo:File)=>{const body=new FormData();body.append('photo',photo);const r=await fetch(`${BASE}/api/crew/profile/photo`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});if(!r.ok)throw new Error('Unable to upload profile photo.');return r.json() as Promise<CrewProfile>},
};

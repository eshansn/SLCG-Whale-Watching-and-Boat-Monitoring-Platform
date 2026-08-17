const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
export interface CrewProfile { id:string; userName:string; displayName:string; nicNumber:string; email:string; phoneNumber:string; position:string; certified:boolean; hasProfilePhoto:boolean; bio?:string }
async function json<T>(path:string,token:string,init?:RequestInit):Promise<T>{const r=await fetch(`${BASE}${path}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init?.headers}});if(!r.ok){const p=await r.json().catch(()=>null) as {title?:string;detail?:string;errors?:Record<string,string[]>}|null;throw new Error(p?.detail??p?.title??(p?.errors?Object.values(p.errors).flat()[0]:undefined)??`Request failed (${r.status}).`)}return r.status===204?undefined as T:r.json()}
export const crewApi={
 profile:(token:string)=>json<CrewProfile>('/api/crew/profile',token),
 update:(token:string,data:{email:string;phoneNumber:string;bio:string})=>json<CrewProfile>('/api/crew/profile',token,{method:'PATCH',body:JSON.stringify(data)}),
 photo:async(token:string)=>{const r=await fetch(`${BASE}/api/crew/profile/photo`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Unable to load profile photo.');return URL.createObjectURL(await r.blob())},
 uploadPhoto:async(token:string,photo:File)=>{const body=new FormData();body.append('photo',photo);const r=await fetch(`${BASE}/api/crew/profile/photo`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});if(!r.ok)throw new Error('Unable to upload profile photo.');return r.json() as Promise<CrewProfile>},
};

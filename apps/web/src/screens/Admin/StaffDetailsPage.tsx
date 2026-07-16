import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../components/ui/icon";
import { initialStaffMembers } from "./StaffPage";
import type { StaffMember, StaffRole } from "./StaffPage";

const roles: StaffRole[] = ["Admin","OPS Room","SLCG HQ","Wildlife","Tourism"];
const read=():StaffMember[]=>{try{const saved=localStorage.getItem("admin-staff-records-v1");return saved?JSON.parse(saved) as StaffMember[]:initialStaffMembers}catch{return initialStaffMembers}};
export default function StaffDetailsPage(){
 const {staffId}=useParams(); const navigate=useNavigate(); const [records,setRecords]=useState(read); const staff=records.find(s=>s.id===Number(staffId));
 if(!staff)return <main className="p-12 text-center"><h1 className="text-xl font-semibold">Staff member not found</h1><button onClick={()=>navigate("/admin/manage-staff")} className="mt-5 text-indigo-700">Back to staff</button></main>;
 const save=(next:StaffMember[])=>{setRecords(next);localStorage.setItem("admin-staff-records-v1",JSON.stringify(next))};
 const changeRole=(role:StaffRole)=>save(records.map(s=>s.id===staff.id?{...s,role}:s));
 const remove=()=>{if(confirm(`Delete ${staff.username}? This cannot be undone.`)){save(records.filter(s=>s.id!==staff.id));navigate("/admin/manage-staff")}};
 return <main className="mx-auto max-w-3xl px-6 py-10"><button onClick={()=>navigate("/admin/manage-staff")} className="text-sm font-semibold text-indigo-700">← Back to staff</button><section className="mt-6 rounded-2xl bg-white p-7 shadow-[0_8px_30px_rgba(15,23,42,.08)]"><div className="flex flex-col justify-between gap-5 sm:flex-row"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-full bg-indigo-50"><Icon name="user" size={25}/></div><div><h1 className="text-2xl font-semibold">{staff.username}</h1><p className="text-sm text-slate-500">Staff member</p></div></div><button onClick={remove} className="rounded-lg border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600">Delete staff</button></div><dl className="mt-8 grid gap-6 border-t pt-7 sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase text-slate-400">Email</dt><dd className="mt-2 text-sm font-medium">{staff.email}</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-400">Role</dt><dd className="mt-2"><select value={staff.role} onChange={e=>changeRole(e.target.value as StaffRole)} className="h-11 w-full rounded-lg border bg-white px-3 text-sm font-semibold">{roles.map(role=><option key={role}>{role}</option>)}</select></dd></div></dl></section></main>;
}

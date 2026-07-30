import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';

export default function ShoreWildlifeNavbar(){
 const [open,setOpen]=useState(false); const {logout}=useAuth(); const navigate=useNavigate();
 const signOut=()=>{logout();navigate('/login',{replace:true})};
 return <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur"><div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link to="/shore-wildlife" className="flex items-center"><img src="/WildlifeAuthority.png" alt="Department of Wildlife Conservation" className="h-10 w-auto object-contain"/></Link><nav className="hidden items-center gap-7 text-sm lg:flex"><Link to="/shore-wildlife" className="font-medium text-slate-600">Trips</Link><Link to="/shore-wildlife/records" className="font-medium text-slate-600">Records</Link><button onClick={signOut} className="rounded-md bg-[#14223d] px-6 py-2.5 font-semibold text-white">Log Out</button></nav><button onClick={()=>setOpen(!open)} className="rounded-md p-2 lg:hidden" aria-label="Toggle navigation">☰</button></div>{open&&<nav className="grid gap-2 border-t p-4 lg:hidden"><Link to="/shore-wildlife" onClick={()=>setOpen(false)}>Trips</Link><Link to="/shore-wildlife/records" onClick={()=>setOpen(false)}>Records</Link><button onClick={signOut} className="text-left">Log Out</button></nav>}</header>;
}

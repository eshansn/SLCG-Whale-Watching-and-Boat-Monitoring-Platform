import { useEffect,useState,type ReactNode } from 'react';
import { Bell,House,Menu,Settings,Ship,UserRound,X } from 'lucide-react';
import { useLocation,useNavigate } from 'react-router-dom';

const items=[{to:'/crew',label:'Dashboard',icon:House},{to:'/crew/profile',label:'Profile',icon:UserRound},{to:'/crew/trips',label:'My Trips',icon:Ship},{to:'/crew/settings',label:'Settings',icon:Settings}];
export function CrewLayout({children,title,className=''}:{children:ReactNode;title?:string;className?:string}){
 const nav=useNavigate(),location=useLocation(); const [open,setOpen]=useState(false);
 useEffect(()=>{document.body.style.overflow=open?'hidden':'';return()=>{document.body.style.overflow=''}},[open]);
 return <main className="min-h-dvh w-full bg-white text-black"><div className={`relative min-h-dvh w-full overflow-hidden bg-white ${className}`}>
  <header className="flex h-[62px] items-center justify-between border-b border-slate-100 bg-white px-4 sm:px-8 lg:px-12"><button onClick={()=>nav('/crew/notifications')} aria-label="Notifications" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100"><Bell size={20}/></button>{title&&<span className="text-sm font-semibold sm:text-base">{title}</span>}<button onClick={()=>setOpen(true)} aria-label="Open menu" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100"><Menu size={27}/></button></header>
  {children}
  {open&&<><button aria-label="Close menu" onClick={()=>setOpen(false)} className="fixed inset-0 z-40 bg-black/35"/><aside className="fixed right-0 top-0 z-50 min-h-dvh w-[280px] bg-white px-7 py-5 shadow-2xl sm:w-[360px]"><div className="flex justify-end"><button onClick={()=>setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100"><X size={22}/></button></div><nav className="mt-9 space-y-2">{items.map(item=><button key={item.to} onClick={()=>{setOpen(false);nav(item.to)}} className={`flex w-full items-center gap-5 rounded-xl px-4 py-4 text-left ${location.pathname===item.to?'bg-slate-100 text-[#162d54]':'hover:bg-slate-50'}`}><item.icon size={23}/><span className="text-sm font-semibold">{item.label}</span></button>)}</nav></aside></>}
 </div></main>
}
export const State=({children,tone='normal'}:{children:ReactNode;tone?:'normal'|'error'})=><div className={`mx-4 rounded-2xl bg-slate-50 p-8 text-center text-xs ${tone==='error'?'text-red-600':'text-slate-500'}`}>{children}</div>;
export const Status=({value}:{value:string})=><span className={`inline-flex items-center gap-1 text-[8px] font-semibold uppercase ${['Approved','Completed'].includes(value)?'text-[#20c928]':value==='Ongoing'?'text-blue-600':'text-amber-500'}`}><i className="h-1.5 w-1.5 rounded-full bg-current"/>{value}</span>;

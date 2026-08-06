import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth";
import { Icon } from "../../../components/ui/icon";
import { House, LogOut, Menu, Settings, Ship, X } from "lucide-react";

const ShoreNavbar = () => {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const onTripsPage = location.pathname.startsWith("/shore/trips");

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/shore" aria-label="Shore Officer dashboard">
          <img src="/SLCG.png" alt="Sri Lanka Coast Guard" className="h-9 w-auto sm:h-10" />
        </Link>

        <nav className="hidden items-center gap-7 text-sm lg:flex" aria-label="Shore Officer navigation">
          <button type="button" aria-label="Notifications" className="text-slate-500 transition hover:text-[#14223d]">
            <Icon name="notification" size={20} />
          </button>
          <Link aria-label={onTripsPage?"Dashboard":"Trips"} title={onTripsPage?"Dashboard":"Trips"} to={onTripsPage ? "/shore" : "/shore/trips"} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-[#14223d]">
            <span className="flex items-center gap-2">{onTripsPage ? <House size={18}/> : <Ship size={18}/>}<span>{onTripsPage ? "Dashboard" : "Trips"}</span></span>
          </Link>
          <Link aria-label="Settings" title="Settings" to="/shore" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-[#14223d]"><span className="flex items-center gap-2"><Settings size={18}/><span>Settings</span></span></Link>
          <button type="button" onClick={signOut} aria-label="Log out" title="Log out" className="rounded-full bg-[#14223d] p-2.5 text-white shadow-sm transition hover:bg-[#22375f]"><span className="flex items-center gap-2"><LogOut size={18}/><span>Log out</span></span></button>
        </nav>

        <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-md hover:bg-slate-100 lg:hidden" aria-label="Toggle navigation" aria-expanded={open}>
          {open?<X size={22}/>:<Menu size={22}/>} 
        </button>
      </div>

      {open && (
        <nav className="grid gap-1 border-t border-slate-200 bg-white px-4 py-4 shadow-lg lg:hidden">
          <Link aria-label={onTripsPage?"Dashboard":"Trips"} title={onTripsPage?"Dashboard":"Trips"} onClick={() => setOpen(false)} to={onTripsPage ? "/shore" : "/shore/trips"} className="flex justify-center rounded-md px-3 py-3 hover:bg-slate-50">{onTripsPage ? <House size={22}/> : <Ship size={22}/>}</Link>
          <Link aria-label="Settings" title="Settings" onClick={() => setOpen(false)} to="/shore" className="flex justify-center rounded-md px-3 py-3 hover:bg-slate-50"><Settings size={22}/></Link>
          <button type="button" onClick={signOut} aria-label="Log out" title="Log out" className="mt-2 flex justify-center rounded-md bg-[#14223d] px-4 py-3 text-white"><LogOut size={22}/></button>
        </nav>
      )}
    </header>
  );
};

export default ShoreNavbar;

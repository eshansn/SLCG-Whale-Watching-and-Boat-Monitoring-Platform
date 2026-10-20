import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/useAuth';
import { Icon } from '../../../components/ui/icon';
import { FileWarning, House, LogOut, Radar, Ship, Siren } from 'lucide-react';

const OPS_HOME_PATH = '/ops'; 

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const currentPath = location.pathname;

  // The core navigation destinations (use full /ops paths)
  const navLinks = [
    { name: 'SOS', path: `${OPS_HOME_PATH}/sos`, icon: Siren },
    { name: 'Trips', path: `${OPS_HOME_PATH}/trips`, icon: Ship },
    { name: 'Monitor', path: `${OPS_HOME_PATH}/monitor`, icon: Radar },
    { name: 'Complaints', path: `${OPS_HOME_PATH}/complaints`, icon: FileWarning },
  ];

  return (
    <header className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-4 bg-[#F8F9FA] z-50 font-['Poppins'] sm:px-8">
      
      {/* 1. Brand / Logo Area */}
      <div className="flex items-center gap-3">
        <Link to={OPS_HOME_PATH} className="hover:opacity-80 transition-opacity flex items-center">
          {/* Vite automatically maps the public folder to the root '/' */}
          <img 
            src="/SLCG.png" 
            alt="Sri Lanka Coast Guard" 
            className="h-10 w-auto object-contain" 
          />
        </Link>
      </div>
      
      {/* 2. Navigation Links & Actions */}
      <nav className="flex flex-wrap items-center gap-3 text-xs font-medium sm:gap-6 sm:text-sm">
        
        {/* Notification Bell (Imported from Icon.tsx) */}
        <Link 
            to={`${OPS_HOME_PATH}/notifications`}
            className="text-slate-500 hover:text-[#1A2B4C] hover:scale-110 transition-all duration-200 flex items-center justify-center"
            >
            <Icon name="notification" size={20} className="text-current" />
        </Link>

        {/* Dynamic Links */}
        {navLinks.map((link) => {
          // Check if this link is the currently active page
          const isActivePage = currentPath === link.path || currentPath.startsWith(link.path + '/');

          return (
            <Link
              key={link.name}
              to={isActivePage ? OPS_HOME_PATH : link.path}
              aria-label={isActivePage?'Dashboard':link.name} title={isActivePage?'Dashboard':link.name} className={`rounded-full p-2 transition-colors ${
                isActivePage
                  ? 'text-[#1A2B4C] font-bold' // Active state (No underline)
                  : 'text-slate-500 hover:text-[#1A2B4C]' // Inactive state
              }`}
            >
              <span className="flex items-center gap-2">{isActivePage?<House size={18}/>:<link.icon size={18}/>}<span>{isActivePage?'Dashboard':link.name}</span></span>
            </Link>
          );
        })}

        {/* Log Out Button */}
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
          aria-label="Log out" title="Log out" className="ml-2 rounded-full bg-[#1A2B4C] p-2.5 text-white shadow-sm hover:bg-[#111C33] hover:shadow transition-all"
        >
          <span className="flex items-center gap-2"><LogOut size={18}/><span>Log out</span></span>
        </button>
        
      </nav>
    </header>
  );
}

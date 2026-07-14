import VesselMap from './components/VesselMap';
import Sidebar from './components/Sidebar';
import { useDashboardStore } from './store/useDashboardStore';
import Navbar from './components/Navbar';
import {Icon} from '../../components/ui/icon';

export default function OPS() {
  const { vessels, activeVesselId, setActiveVessel } = useDashboardStore();
  const activeVessel = vessels.find(v => v.id === activeVesselId);

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-slate-800 flex flex-col h-screen overflow-hidden">
      
      {/* --- Top Navigation Header --- */}
      <Navbar />

      {/* --- Main Workspace Area --- */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6 pt-2">
        
        {/* --- Left Side Control Interface --- */}
        <aside className="w-[300px] flex flex-col gap-6 overflow-y-auto shrink-0 pr-1">
          
          {/* Greeting */}
          <div>
            <h2 className="text-xl font-medium text-[#1A2B4C] mb-0.5">Hello,</h2>
            <h1 className="text-4xl font-bold text-[#1A2B4C] tracking-tight">OPS room !</h1>
            <p className="text-xs text-slate-400 mt-2">Stay In Control, Stay Connected.</p>
          </div>

          {/* Emergency Alert Button */}
          <div className="bg-[#FF0B0B] text-white p-4 rounded-xl shadow-lg shadow-red-500/20 flex items-center justify-between cursor-pointer hover:scale-[1.02] transition-transform">
            <span className="font-semibold tracking-wide">0 Emergencies</span>
            <Icon name="notification" size={20} className="fill-[#ffffff]" />
          </div>

          {/* Ongoing Trips List */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-50">
              <h3 className="font-bold text-[#1A2B4C]">
                {vessels.length.toString().padStart(2, '0')} Ongoing Trips
              </h3>
              <Icon name="vessel" size={20} className="fill-[#ffffff]" />
            </div>
            
            <ul className="space-y-1 overflow-y-auto flex-1 pr-2">
              {vessels.map((vessel) => {
                const isSelected = activeVesselId === vessel.id;
                return (
                  <li 
                    key={vessel.id}
                    onClick={() => setActiveVessel(vessel.id)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 border-l-2
                      ${isSelected 
                        ? 'bg-slate-50 border-[#1A2B4C]' 
                        : 'bg-transparent border-transparent hover:bg-slate-50/50'
                      }
                    `}
                  >
                    <div>
                      <p className="font-bold text-sm text-[#1A2B4C]">{vessel.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase">{vessel.regNo}</p>
                    </div>
                    <button className="text-slate-300 hover:text-[#1A2B4C] transition-colors">
                      ⓘ
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* --- Dynamic Center Canvas Work Area --- */}
        <section className="flex-1 relative rounded-[32px] overflow-hidden shadow-inner border border-slate-200 bg-slate-900">
          
          {/* Map Base */}
          <VesselMap />
          
          {/* The Dynamic Connecting Line Overlay */}
          {activeVesselId && activeVessel && (
             <svg className="absolute inset-0 w-full h-full pointer-events-none z-40">
                {/* Point A: The vessel's dynamic location.
                  Point B: The left edge of the sidebar (100% width minus 400px).
                  Using SVG view coordinates relative to the container sizes.
                */}
                <path 
                  d={`M ${activeVessel.lon}% ${activeVessel.lat}% C 70% ${activeVessel.lat}%, 80% 50%, calc(100% - 400px) 50%`}
                  fill="none" 
                  stroke="rgba(255, 255, 255, 0.6)" 
                  strokeWidth="1.5"
                  strokeDasharray="5 5"
                  className="animate-pulse"
                />
                
                {/* Small connecting dot anchored to the sidebar */}
                <circle cx="calc(100% - 400px)" cy="50%" r="4" fill="white" className="shadow-lg" />
             </svg>
          )}

          {/* Slide-out Overlay */}
          <Sidebar />
          
        </section>

      </main>
    </div>
  );
}
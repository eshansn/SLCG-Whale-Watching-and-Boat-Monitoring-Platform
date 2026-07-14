import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useDashboardStore } from '../store/useDashboardStore';

export default function Sidebar() {
  const { activeVesselId, vessels, setActiveVessel } = useDashboardStore();
  const sidebarRef = useRef<HTMLDivElement>(null);

  const selectedVessel = vessels.find((v) => v.id === activeVesselId);

  useGSAP(() => {
    if (activeVesselId) {
      gsap.to(sidebarRef.current, { x: 0, opacity: 1, duration: 0.4, ease: 'power3.out' });
    } else {
      gsap.to(sidebarRef.current, { x: 500, opacity: 0, duration: 0.3, ease: 'power3.in' });
    }
  }, [activeVesselId]);

  return (
    <div
      ref={sidebarRef}
      style={{ transform: 'translateX(500px)', opacity: 0 }}
      className="absolute top-4 right-4 h-[calc(100%-32px)] w-[400px] bg-white rounded-3xl shadow-2xl z-50 overflow-y-auto flex flex-col border border-slate-100"
    >
      {selectedVessel && (
        <>
          {/* Top Image Section (Replace with your actual image logic) */}
          <div className="relative h-48 w-full bg-slate-200">
             {/* Using a placeholder gradient to simulate the image fade */}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent z-10" />
            <img 
              src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=800&auto=format&fit=crop" 
              alt="Vessel" 
              className="w-full h-full object-cover"
            />
          </div>

          <div className="px-6 pb-6 -mt-4 relative z-20">
            {/* Header Title */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-bold text-[#1A2B4C] tracking-tight">{selectedVessel.name}</h2>
                <span className="text-slate-400 cursor-pointer">ⓘ</span>
              </div>
              <button onClick={() => setActiveVessel(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-slate-400 font-mono">{selectedVessel.regNo}</span>
              <span className="text-xs text-emerald-500 font-medium tracking-wide">Approved</span>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 space-y-2">
              <div className="grid grid-cols-[100px_1fr] text-sm">
                <span className="font-bold text-[#1A2B4C]">Coordinates</span>
                <span className="text-slate-600">5.949186, 80.438509</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] text-sm">
                <span className="font-bold text-[#1A2B4C]">Departure</span>
                <span className="text-slate-600">06:32:11 Hrs</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] text-sm">
                <span className="font-bold text-[#1A2B4C]">Arrival</span>
                <span className="text-slate-600">DNA</span>
              </div>
            </div>

            {/* Info Cards */}
            <div className="mt-6 space-y-4">
              
              {/* Vessel Information */}
              <div className="bg-[#F8F9FA] rounded-xl p-4">
                <h3 className="font-bold text-[#1A2B4C] mb-3">Vessel Information</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ['Length', '12.8 M'],
                    ['Beam (Width)', '3.9 M'],
                    ['Cruising Speed', '20 Knots'],
                    ['Maximum Speed', '28 Knots'],
                    ['Maximum Capacity', '35 Passengers'],
                    ['Life Jackets', '37'],
                  ].map(([label, val]) => (
                    <div key={label} className="grid grid-cols-[140px_1fr]">
                      <span className="font-semibold text-[#1A2B4C]">{label}</span>
                      <span className="text-slate-600">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Passenger Information */}
              <div className="bg-[#F8F9FA] rounded-xl p-4 relative group cursor-pointer">
                <span className="absolute top-4 right-4 text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">More Info ⚙</span>
                <h3 className="font-bold text-[#1A2B4C] mb-3">Passenger Information</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ['Passengers Onboard', '24'],
                    ['Children Onboard', '03'],
                    ['Special Needs', '00'],
                  ].map(([label, val]) => (
                    <div key={label} className="grid grid-cols-[140px_1fr]">
                      <span className="font-semibold text-[#1A2B4C]">{label}</span>
                      <span className="text-slate-600">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Crew Information */}
              <div className="bg-[#F8F9FA] rounded-xl p-4 relative group cursor-pointer">
                <span className="absolute top-4 right-4 text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">More Info ⚙</span>
                <h3 className="font-bold text-[#1A2B4C] mb-3">Crew Information</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ['Life Savers', '03'],
                    ['Divers', '02'],
                  ].map(([label, val]) => (
                    <div key={label} className="grid grid-cols-[140px_1fr]">
                      <span className="font-semibold text-[#1A2B4C]">{label}</span>
                      <span className="text-slate-600">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}
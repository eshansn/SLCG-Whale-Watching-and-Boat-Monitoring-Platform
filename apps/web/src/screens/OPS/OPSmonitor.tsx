import Navbar from './components/Navbar';
import VesselMap from './components/VesselMap';
import Sidebar from './components/Sidebar';
import { useDashboardStore } from './store/useDashboardStore';

export default function OPSMonitor() {
  const { vessels, activeVesselId, setActiveVessel } = useDashboardStore();
  const activeVessel = vessels.find((vessel) => vessel.id === activeVesselId);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F8F9FA] font-sans text-slate-800">
      <Navbar />

      <main className="flex flex-1 overflow-hidden">

        <section className="relative flex-1 overflow-hidden bg-slate-900">
          <div className="h-full w-full overflow-hidden [&>div]:rounded-none">
            <VesselMap />
          </div>
          <Sidebar />
        </section>
      </main>
    </div>
  );
}

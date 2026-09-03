import Navbar from './components/Navbar';
import VesselMap from './components/VesselMap';
import Sidebar from './components/Sidebar';
import { useDashboardStore } from './store/useDashboardStore';
import { useAuth } from '../../auth/useAuth';
import { useEffect } from 'react';
import { connectOperations, type OperationsChange } from '../../operations/operationsApi';

export default function OPSMonitor() {
  const { loadVessels, applyGpsTelemetry } = useDashboardStore();
  const { session } = useAuth();
  useEffect(() => {
    if (!session) return;
    const loadFleet = () => void loadVessels(session.accessToken);
    const reconcile = (change?: OperationsChange) => {
      const state = useDashboardStore.getState();
      const tracking = state.activeTripTracking;
      const selectedTripChanged = change?.entity === 'trip' && change.id === tracking?.tripId;
      if (tracking && (!change || selectedTripChanged))
        void state.loadActiveTripTracking(session.accessToken, tracking.boatId, tracking.tripId)
          .finally(loadFleet);
      else loadFleet();
    };
    loadFleet();
    const disconnect = connectOperations(session.accessToken, reconcile, applyGpsTelemetry);
    const interval = window.setInterval(loadFleet, 10000);
    return () => { disconnect(); window.clearInterval(interval); };
  }, [applyGpsTelemetry, loadVessels, session]);

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

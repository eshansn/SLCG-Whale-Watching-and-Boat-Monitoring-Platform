import { create } from 'zustand';

export interface Vessel {
  id: string;
  name: string;
  type: string;     // Added for the sidebar
  regNo: string;    // Added for the sidebar
  lat: number;
  lon: number;
  heading: number; 
  color: string;
  status: 'active' | 'idle' | 'emergency';
}

interface DashboardState {
  activeVesselId: string | null;
  vessels: Vessel[];
  setActiveVessel: (id: string | null) => void;
  setVessels: (vessels: Vessel[]) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  activeVesselId: null,
  
  // Pre-fill the array with our responsive mock data instead of leaving it empty
  vessels: [
    // Real GPS coordinates near Mirissa Harbor and Whale Watching zones
    { id: 'v1', name: 'FV Mirissa King', type: 'Fishing', regNo: 'SL-IVB-3047', lat: 5.942, lon: 80.455, heading: 45, color: '#FCD34D', status: 'active' },
    { id: 'v2', name: 'WW Sea Princess', type: 'Whale Watching', regNo: 'SL-WW-1022', lat: 5.935, lon: 80.448, heading: 120, color: '#A855F7', status: 'active' },
    { id: 'v3', name: 'MV Indo-Ceylon', type: 'Cargo', regNo: 'SL-CR-9941', lat: 5.920, lon: 80.430, heading: 270, color: '#94A3B8', status: 'idle' },
    { id: 'v4', name: 'FV Ocean Harvest', type: 'Fishing', regNo: 'SL-IVB-8821', lat: 5.850, lon: 80.460, heading: 90, color: '#FCD34D', status: 'active' },
  ],
  
  setActiveVessel: (id) => set({ activeVesselId: id }),
  setVessels: (vessels) => set({ vessels }),
}));
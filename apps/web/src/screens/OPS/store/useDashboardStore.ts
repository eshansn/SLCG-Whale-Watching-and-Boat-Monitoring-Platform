import { create } from 'zustand';
import { operationsApi, type BoatRouteHistory, type GpsTelemetryUpdate, type TripTrackingSummary } from '../../../operations/operationsApi';

export interface Vessel {
  id: string;
  name: string;
  regNo: string;
  imageUrl?: string;
  activeTripId?: string;
  lat: number;
  lon: number;
  heading: number; 
  color: string;
  status: 'active' | 'idle' | 'emergency';
  certificationApproval: string;
  wildlifeApproval: string;
  operationalStatus: string;
  coordinatesRecordedAtUtc?: string;
  coordinatesReceivedAtUtc?: string;
  trackerStatus: 'Online' | 'Stale' | 'Offline';
  altitudeMeters?: number;
  departureUtc?: string;
  arrivalUtc?: string;
  lengthMeters: number;
  beamMeters: number;
  cruisingSpeedKnots?: number;
  maximumSpeedKnots: number;
  maximumCapacity: number;
  lifeJacketCount: number;
  passengerCount: number;
  childrenCount: number;
  specialNeedsCount: number;
  lifeSaverCount: number;
  diverCount: number;
  coxswainCount: number;
}

interface DashboardState {
  activeVesselId: string | null;
  vessels: Vessel[];
  routeHistory: BoatRouteHistory | null;
  routeHistoryBoatId: string | null;
  activeTripTracking: TripTrackingSummary | null;
  activeTripTrackingBoatId: string | null;
  activeTripTrackingLoading: boolean;
  activeTripTrackingError: string;
  trackingRequestKey: string | null;
  setActiveVessel: (id: string | null) => void;
  setVessels: (vessels: Vessel[]) => void;
  setRouteHistory: (boatId: string, history: BoatRouteHistory) => void;
  clearRouteHistory: () => void;
  loadActiveTripTracking: (token: string, boatId: string, tripId: string) => Promise<void>;
  clearActiveTripTracking: () => void;
  applyGpsTelemetry: (update: GpsTelemetryUpdate) => void;
  loadVessels: (token: string) => Promise<void>;
}

let trackingRequestSequence = 0;

export const useDashboardStore = create<DashboardState>((set) => ({
  activeVesselId: null,
  vessels: [],
  routeHistory: null,
  routeHistoryBoatId: null,
  activeTripTracking: null,
  activeTripTrackingBoatId: null,
  activeTripTrackingLoading: false,
  activeTripTrackingError: '',
  trackingRequestKey: null,

  setActiveVessel: (id) => set((state) => {
    const nextId = state.activeVesselId === id ? null : id;
    return nextId === state.activeVesselId ? { activeVesselId: nextId } : {
      activeVesselId: nextId,
      routeHistory: null,
      routeHistoryBoatId: null,
      activeTripTracking: null,
      activeTripTrackingBoatId: null,
      activeTripTrackingLoading: false,
      activeTripTrackingError: '',
      trackingRequestKey: null,
    };
  }),
  setVessels: (vessels) => set({ vessels }),
  setRouteHistory: (boatId, routeHistory) => set({ routeHistory, routeHistoryBoatId: boatId }),
  clearRouteHistory: () => set({ routeHistory: null, routeHistoryBoatId: null }),
  loadActiveTripTracking: async (token, boatId, tripId) => {
    const requestKey = `${boatId}:${tripId}:${++trackingRequestSequence}`;
    set({ activeTripTrackingLoading: true, activeTripTrackingError: '', trackingRequestKey: requestKey });
    try {
      const tracking = await operationsApi.tripTrackingSummary(token, tripId);
      set((state) => state.trackingRequestKey === requestKey && state.activeVesselId === boatId
        ? {
            activeTripTracking: tracking,
            activeTripTrackingBoatId: boatId,
            activeTripTrackingLoading: false,
            activeTripTrackingError: '',
          }
        : {});
    } catch (reason) {
      set((state) => state.trackingRequestKey === requestKey && state.activeVesselId === boatId
        ? {
            activeTripTrackingLoading: false,
            activeTripTrackingError: reason instanceof Error ? reason.message : 'Unable to load active trip tracking.',
          }
        : {});
    }
  },
  clearActiveTripTracking: () => set({
    activeTripTracking: null,
    activeTripTrackingBoatId: null,
    activeTripTrackingLoading: false,
    activeTripTrackingError: '',
    trackingRequestKey: null,
  }),
  applyGpsTelemetry: (update) => set((state) => {
    const vessels = state.vessels.map((vessel) => vessel.id === update.boatId ? {
      ...vessel,
      lat: update.latitude,
      lon: update.longitude,
      cruisingSpeedKnots: update.speedKnots,
      heading: update.headingDegrees ?? vessel.heading,
      altitudeMeters: update.altitudeMeters,
      coordinatesRecordedAtUtc: update.recordedAtUtc,
      coordinatesReceivedAtUtc: update.receivedAtUtc,
      trackerStatus: update.trackerStatus,
    } : vessel);
    const tracking = state.activeTripTracking;
    if (!tracking || state.activeTripTrackingBoatId !== update.boatId ||
        tracking.status !== 'Active' || update.activeTripId !== tracking.tripId ||
        !tracking.startedAtUtc || new Date(update.recordedAtUtc) < new Date(tracking.startedAtUtc))
      return { vessels };

    const lastPoint = tracking.route.at(-1);
    const recordedAt = new Date(update.recordedAtUtc).getTime();
    const lastRecordedAt = lastPoint ? new Date(lastPoint.recordedAtUtc).getTime() : Number.NEGATIVE_INFINITY;
    const stops = update.stops ?? tracking.stops;
    if (!Number.isFinite(recordedAt) || recordedAt <= lastRecordedAt)
      return { vessels, activeTripTracking: { ...tracking, stops,
        stopsDurationSeconds: stops.reduce((total, stop) => total + stop.durationSeconds, 0) } };

    const currentPosition = {
      latitude: update.latitude,
      longitude: update.longitude,
      speedKnots: update.speedKnots,
      headingDegrees: update.headingDegrees,
      recordedAtUtc: update.recordedAtUtc,
    };
    return {
      vessels,
      activeTripTracking: {
        ...tracking,
        route: [...tracking.route, currentPosition],
        currentPosition,
        stops,
        stopsDurationSeconds: stops.reduce((total, stop) => total + stop.durationSeconds, 0),
      },
    };
  }),
  loadVessels: async (token) => {
    const records = await operationsApi.vesselMap(token);
    set({ vessels: records.filter((record) => record.latitude != null && record.longitude != null).map((record) => ({
      ...record, regNo: record.registrationNumber, lat: record.latitude!, lon: record.longitude!,
      heading: record.headingDegrees ?? 0, color: record.activeTripId ? '#10B981' : '#64748B',
      status: record.activeTripId ? 'active' : 'idle',
    })) });
  },
}));

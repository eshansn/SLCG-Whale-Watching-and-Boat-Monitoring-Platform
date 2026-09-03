import React, { useEffect, useMemo, useRef } from 'react';
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useDashboardStore } from '../store/useDashboardStore';

export default function VesselMap() {
  const {
    vessels,
    activeVesselId,
    routeHistory,
    routeHistoryBoatId,
    activeTripTracking,
    activeTripTrackingBoatId,
    activeTripTrackingLoading,
    setActiveVessel,
  } = useDashboardStore();
  const mapRef = useRef<MapRef>(null);
  const lastFittedOverlayRef = useRef<string | null>(null);
  const selectedTracking = activeTripTrackingBoatId === activeVesselId ? activeTripTracking : null;
  const { historyPoints, tripRouteLines, unassignedRouteLines } = useMemo(() => {
    if (selectedTracking || routeHistoryBoatId !== activeVesselId || !routeHistory)
      return { historyPoints: [], tripRouteLines: [], unassignedRouteLines: [] };
    return {
      historyPoints: [...routeHistory.trips.flatMap((trip) => trip.route), ...routeHistory.unassignedRoutes.flatMap((route) => route.route)],
      tripRouteLines: routeHistory.trips.filter((trip) => trip.route.length >= 2).map((trip) => ({
        type: 'Feature' as const,
        properties: { tripId: trip.tripId },
        geometry: { type: 'LineString' as const, coordinates: trip.route.map((point) => [point.longitude, point.latitude]) },
      })),
      unassignedRouteLines: routeHistory.unassignedRoutes.filter((route) => route.route.length >= 2).map((route) => ({
        type: 'Feature' as const,
        properties: { segmentNumber: route.segmentNumber },
        geometry: { type: 'LineString' as const, coordinates: route.route.map((point) => [point.longitude, point.latitude]) },
      })),
    };
  }, [activeVesselId, routeHistory, routeHistoryBoatId, selectedTracking]);
  const activeRoute = useMemo(() => selectedTracking?.route ?? [], [selectedTracking?.route]);
  const activeRouteLine = useMemo(() => activeRoute.length >= 2 ? {
    type: 'Feature' as const,
    properties: { tripId: selectedTracking?.tripId },
    geometry: { type: 'LineString' as const, coordinates: activeRoute.map((point) => [point.longitude, point.latitude]) },
  } : null, [activeRoute, selectedTracking?.tripId]);
  const detailedPoints = selectedTracking ? activeRoute : historyPoints;
  const overlayKey = selectedTracking
    ? `active:${selectedTracking.tripId}`
    : routeHistoryBoatId === activeVesselId && routeHistory
      ? `history:${routeHistoryBoatId}:${routeHistory.fromUtc}:${routeHistory.toUtc}`
      : null;

  // Smooth camera pan when a vessel is selected from the sidebar
  useEffect(() => {
    if (activeVesselId && mapRef.current && detailedPoints.length === 0) {
      const selectedVessel = vessels.find(v => v.id === activeVesselId);
      if (selectedVessel) {
        mapRef.current.flyTo({
          center: [selectedVessel.lon, selectedVessel.lat],
          zoom: 14.5,
          duration: 1500, // Smooth 1.5s pan
          essential: true
        });
      }
    }
  }, [activeVesselId, detailedPoints.length, vessels]);

  useEffect(() => {
    if (!overlayKey) {
      lastFittedOverlayRef.current = null;
      return;
    }
    if (!mapRef.current || detailedPoints.length === 0 || lastFittedOverlayRef.current === overlayKey) return;
    lastFittedOverlayRef.current = overlayKey;
    if (detailedPoints.length === 1) {
      mapRef.current.flyTo({ center: [detailedPoints[0].longitude, detailedPoints[0].latitude], zoom: 14, duration: 650 });
      return;
    }
    const longitudes = detailedPoints.map((point) => point.longitude);
    const latitudes = detailedPoints.map((point) => point.latitude);
    const rightPadding = mapRef.current.getContainer().clientWidth > 620 ? 430 : 55;
    mapRef.current.fitBounds([
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ], { padding: { top: 55, bottom: 55, left: 55, right: rightPadding }, duration: 650, maxZoom: 15 });
  }, [detailedPoints, overlayKey]);

  return (
    <div className="w-full h-full relative rounded-[32px] overflow-hidden">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 80.45,  // Center of Mirissa Coast
          latitude: 5.94,
          zoom: 13,
        }}
        // Using Carto's free Voyager style (No API key required!)
        mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
        onClick={() => setActiveVessel(null)} // Click empty ocean to deselect
        interactiveLayerIds={[]} 
      >
        {activeRouteLine && (
          <Source id="monitor-active-trip-route" type="geojson" data={activeRouteLine}>
            <Layer id="monitor-active-trip-route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#2563eb', 'line-width': 5, 'line-opacity': 0.9 }} />
          </Source>
        )}
        {tripRouteLines.length > 0 && (
          <Source id="dashboard-trip-history" type="geojson" data={{ type: 'FeatureCollection', features: tripRouteLines }}>
            <Layer id="dashboard-trip-history-lines" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#2563eb', 'line-width': 4, 'line-opacity': 0.88 }} />
          </Source>
        )}
        {unassignedRouteLines.length > 0 && (
          <Source id="dashboard-unassigned-history" type="geojson" data={{ type: 'FeatureCollection', features: unassignedRouteLines }}>
            <Layer id="dashboard-unassigned-history-lines" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#7c3aed', 'line-width': 3, 'line-opacity': 0.75, 'line-dasharray': [2, 2] }} />
          </Source>
        )}
        {selectedTracking && activeRoute.length > 0 && (
          <Marker longitude={activeRoute[0].longitude} latitude={activeRoute[0].latitude} anchor="center">
            <div title="Trip start" aria-label="Trip start" className="h-4 w-4 rounded-full border-[3px] border-white bg-emerald-600 shadow-lg" />
          </Marker>
        )}
        {selectedTracking?.stops.map((stop) => {
          const details = formatStopDetails(stop.startedAtUtc, stop.endedAtUtc, stop.durationSeconds, stop.isOngoing);
          return (
            <Marker key={stop.startedAtUtc} longitude={stop.longitude} latitude={stop.latitude} anchor="center" onClick={(event) => event.originalEvent.stopPropagation()}>
              <button type="button" title={details} aria-label={details} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-amber-500 shadow-lg">
                <span className="h-2.5 w-2.5 rounded-sm bg-white" />
              </button>
            </Marker>
          );
        })}
        {/* Render our custom SVG Markers on the real map */}
        {vessels.map((vessel) => {
          const isSelected = activeVesselId === vessel.id;
          
          return (
            <Marker
              key={vessel.id}
              longitude={vessel.lon}
              latitude={vessel.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setActiveVessel(vessel.id);
              }}
            >
              <div className="relative flex flex-col items-center group cursor-pointer z-50">
                {/* Pulsing ring for active state */}
                {isSelected && (
                  <span className="absolute w-12 h-12 bg-white opacity-50 rounded-full animate-ping pointer-events-none"></span>
                )}

                {/* Vessel Arrow */}
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill={vessel.color}
                  style={{ transform: `rotate(${vessel.heading}deg)` }}
                  className={`transition-all duration-300 drop-shadow-lg
                    ${isSelected 
                      ? 'scale-125 stroke-white stroke-[2.5px]' 
                      : 'stroke-slate-800 stroke-1 group-hover:scale-110'
                    }
                  `}
                >
                  <path d="M12 2L22 20L12 17L2 20L12 2Z" />
                </svg>

                {/* Dark Premium Label */}
                <span className={`mt-2 px-2 py-0.5 bg-[#1A2B4C] text-white text-[10px] font-bold tracking-wide rounded shadow-xl pointer-events-none transition-opacity absolute top-full
                  ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                `}>
                  {vessel.name}
                </span>
              </div>
            </Marker>
          );
        })}
      </Map>
      {activeVesselId && activeTripTrackingLoading && !selectedTracking && <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-600 shadow">Loading travelled route…</div>}
      {selectedTracking && activeRoute.length === 0 && <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-600 shadow">Waiting for GPS data</div>}
    </div>
  );
}

function formatStopDetails(startedAtUtc: string, endedAtUtc: string | undefined, durationSeconds: number, isOngoing: boolean) {
  const time = (value: string) => new Intl.DateTimeFormat('en-LK', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return isOngoing
    ? `Stop · Started ${time(startedAtUtc)} · ${minutes} min · Ongoing`
    : `Stop · ${time(startedAtUtc)}–${endedAtUtc ? time(endedAtUtc) : 'TBA'} · ${minutes} min`;
}

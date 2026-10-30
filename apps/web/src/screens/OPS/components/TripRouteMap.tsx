import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TripTrackingSummary } from "../../../operations/operationsApi";
import StopPointMarker from "./StopPointMarker";
import { createStopMarkerOffsets } from "./stopMarkerLayout";

const routeLayer = {
  id: "trip-travelled-route",
  type: "line" as const,
  layout: { "line-cap": "round" as const, "line-join": "round" as const },
  paint: { "line-color": "#2563eb", "line-width": 5, "line-opacity": 0.9 },
};

const overlappingMarkerDistanceMeters = 20;

interface TripRouteMapProps {
  summary: TripTrackingSummary;
  vesselName: string;
  fallbackLatitude?: number;
  fallbackLongitude?: number;
  recordedOnly?: boolean;
  emptyMessage?: string;
}

export default function TripRouteMap({
  summary,
  vesselName,
  fallbackLatitude,
  fallbackLongitude,
  recordedOnly = false,
  emptyMessage,
}: TripRouteMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [selectedStopKey, setSelectedStopKey] = useState<string | null>(null);
  const [mapError, setMapError] = useState(false);
  const route = summary.route;
  const stops = useMemo(() => [...(summary.stops ?? [])]
    .sort((first, second) => new Date(first.startedAtUtc).getTime() - new Date(second.startedAtUtc).getTime()),
  [summary.stops]);
  const stopMarkerOffsets = useMemo(() => createStopMarkerOffsets(stops), [stops]);
  const line = useMemo(() => ({
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: route.map((point) => [point.longitude, point.latitude]),
    },
  }), [route]);

  const fitRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (route.length >= 2) {
      const longitudes = route.map((point) => point.longitude);
      const latitudes = route.map((point) => point.latitude);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ];
      map.fitBounds(bounds, { padding: 58, duration: 650, maxZoom: 15 });
      return;
    }
    const point = route[0] ?? (fallbackLatitude != null && fallbackLongitude != null
      ? { latitude: fallbackLatitude, longitude: fallbackLongitude }
      : undefined);
    if (point) map.flyTo({ center: [point.longitude, point.latitude], zoom: 13.5, duration: 500 });
  }, [fallbackLatitude, fallbackLongitude, route]);

  const start = route[0];
  const last = route.at(-1);
  const activePosition = recordedOnly ? (summary.status === "Active" ? last : undefined) : summary.currentPosition ?? (summary.status === "Active" ? last : undefined);
  const showFallback = summary.status === "NotStarted" && fallbackLatitude != null && fallbackLongitude != null;
  const startOverlapsVessel = start != null && activePosition != null &&
    distanceMeters(start.latitude, start.longitude, activePosition.latitude, activePosition.longitude) <= overlappingMarkerDistanceMeters;
  const startOverlapsEnd = start != null && summary.status === "Completed" && last != null &&
    distanceMeters(start.latitude, start.longitude, last.latitude, last.longitude) <= overlappingMarkerDistanceMeters;
  const showStart = start != null && (recordedOnly || (!startOverlapsVessel && !startOverlapsEnd));

  useEffect(() => { fitRoute(); }, [fitRoute]);

  return (
    <div className={recordedOnly ? "relative h-[360px] overflow-hidden rounded-xl lg:h-[500px]" : "relative h-full min-h-[360px] overflow-hidden rounded-xl lg:min-h-[500px]"}>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: (recordedOnly ? start?.longitude : undefined) ?? fallbackLongitude ?? 80.425, latitude: (recordedOnly ? start?.latitude : undefined) ?? fallbackLatitude ?? 5.935, zoom: fallbackLatitude == null ? 11.7 : 13.5 }}
        mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
        onLoad={fitRoute}
        onClick={() => setSelectedStopKey(null)}
        onError={recordedOnly ? () => setMapError(true) : undefined}
        reuseMaps
      >
        {route.length >= 2 && <Source id="trip-route" type="geojson" data={line}><Layer {...routeLayer} /></Source>}
        {recordedOnly && <NavigationControl position="bottom-right" showCompass={false} />}
        {showStart && <Marker longitude={start.longitude} latitude={start.latitude} anchor="center" offset={recordedOnly && (startOverlapsVessel || startOverlapsEnd) ? [-18, 0] : undefined}><MapDot color="#16a34a" label="Start" /></Marker>}
        {summary.status === "Completed" && (!recordedOnly || summary.endedAtUtc) && last && <Marker longitude={last.longitude} latitude={last.latitude} anchor="center"><MapDot color="#dc2626" label="End" /></Marker>}
        {stops.map((stop, index) => {
          const markerKey = `${stop.startedAtUtc}:${index}`;
          return <StopPointMarker key={markerKey} markerKey={markerKey} stop={stop} number={index + 1} selected={selectedStopKey === markerKey} onSelect={setSelectedStopKey} onClose={() => setSelectedStopKey(null)} offset={stopMarkerOffsets[index] ?? (stop.isOngoing ? [18, 14] : undefined)} />;
        })}
        {activePosition && <Marker longitude={activePosition.longitude} latitude={activePosition.latitude} anchor="center"><BoatMarker vesselName={vesselName} /></Marker>}
        {showFallback && <Marker longitude={fallbackLongitude} latitude={fallbackLatitude} anchor="center"><BoatMarker vesselName={vesselName} muted /></Marker>}
      </Map>
      {route.length === 0 && emptyMessage && <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center p-6"><p className="rounded-xl border border-slate-200 bg-white/95 px-5 py-4 text-center text-sm font-medium text-slate-600 shadow-sm">{emptyMessage}</p></div>}
      {recordedOnly && mapError && <p role="alert" className="absolute bottom-3 left-3 right-14 rounded-lg bg-white/95 p-3 text-xs text-slate-600">Map tiles could not be loaded. Recorded trip coordinates remain available above.</p>}
      {!(route.length === 0 && emptyMessage) && <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-[10px] font-bold uppercase shadow">
        {summary.status === "NotStarted" ? "Trip has not started" : route.length === 0 ? "Waiting for GPS data" : summary.status === "Active" ? "Live travelled route" : "Completed travelled route"}
      </div>}
    </div>
  );
}

function MapDot({ color, label }: { color: string; label: string }) {
  return <div className="flex flex-col items-center"><span className="h-4 w-4 rounded-full border-[3px] border-white shadow" style={{ backgroundColor: color }} /><span className="mt-1 rounded bg-[#14223d] px-2 py-0.5 text-[9px] font-semibold text-white shadow">{label}</span></div>;
}

function BoatMarker({ vesselName, muted = false }: { vesselName: string; muted?: boolean }) {
  return <div className="relative flex flex-col items-center"><svg width="34" height="34" viewBox="0 0 24 24" fill={muted ? "#64748b" : "#a855f7"} style={{ transform: "rotate(118deg)" }} className="stroke-white stroke-[2px] drop-shadow-lg"><path d="M12 2L22 20L12 17L2 20L12 2Z" /></svg><span className="absolute top-full mt-1 whitespace-nowrap rounded bg-[#14223d] px-2 py-1 text-[9px] font-bold text-white">{vesselName}</span></div>;
}

function distanceMeters(firstLatitude: number, firstLongitude: number, secondLatitude: number, secondLongitude: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(secondLatitude - firstLatitude);
  const longitudeDelta = radians(secondLongitude - firstLongitude);
  const firstLatitudeRadians = radians(firstLatitude);
  const secondLatitudeRadians = radians(secondLatitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitudeRadians) * Math.cos(secondLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

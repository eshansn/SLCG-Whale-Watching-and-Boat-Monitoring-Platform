import Map, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

interface TripStatusMapProps {
  ongoing: boolean;
  vesselName: string;
  latitude?: number;
  longitude?: number;
}

export default function TripStatusMap({
  ongoing,
  vesselName,
  latitude,
  longitude,
}: TripStatusMapProps) {
  const hasLocation = latitude != null && longitude != null;
  const mapLatitude = latitude ?? 5.935;
  const mapLongitude = longitude ?? 80.425;

  return (
    <div className="relative h-full min-h-[250px] overflow-hidden rounded-xl">
      <Map
        key={`${mapLatitude}-${mapLongitude}`}
        initialViewState={{ longitude: mapLongitude, latitude: mapLatitude, zoom: hasLocation ? 13.5 : 11.7 }}
        mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
      >
        {hasLocation && (
          <Marker longitude={mapLongitude} latitude={mapLatitude} anchor="center">
            <div className="relative flex flex-col items-center">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="#a855f7" style={{ transform: "rotate(118deg)" }} className="stroke-white stroke-[2px] drop-shadow-lg">
                <path d="M12 2L22 20L12 17L2 20L12 2Z" />
              </svg>
              <span className="absolute top-full mt-1 whitespace-nowrap rounded bg-[#14223d] px-2 py-1 text-[9px] font-bold text-white">{vesselName}</span>
            </div>
          </Marker>
        )}
      </Map>
      <div className="pointer-events-none absolute left-3 top-3 rounded bg-white/90 px-3 py-2 text-[10px] font-bold uppercase shadow">
        {!hasLocation ? "Location unavailable" : ongoing ? "Live vessel location" : "Latest vessel location"}
      </div>
    </div>
  );
}

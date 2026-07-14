import React, { useEffect, useRef } from 'react';
import Map, { Marker, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useDashboardStore } from '../store/useDashboardStore';

export default function VesselMap() {
  const { vessels, activeVesselId, setActiveVessel } = useDashboardStore();
  const mapRef = useRef<MapRef>(null);

  // Smooth camera pan when a vessel is selected from the sidebar
  useEffect(() => {
    if (activeVesselId && mapRef.current) {
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
  }, [activeVesselId, vessels]);

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
    </div>
  );
}
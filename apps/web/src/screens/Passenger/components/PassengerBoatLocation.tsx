import { usePassengerLocale } from '../i18n/usePassengerLocale';
import { useEffect, useState } from "react";
import { Compass, MapPin, RefreshCw, Ship } from "lucide-react";
import Map, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  getPassengerBoatLocation,
  type PassengerBoatLocation as PassengerBoatLocationData,
} from "../passengerTripApi";

const REFRESH_INTERVAL_MS = 10_000;

export default function PassengerBoatLocation() {
  const { t, locale, displayValue, translateMessage } = usePassengerLocale();
  const [location, setLocation] = useState<PassengerBoatLocationData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const load = async (): Promise<void> => {
      try {
        const result = await getPassengerBoatLocation();
        if (!active) return;
        setLocation(result);
        setError("");
        if (result.shouldRefresh) timer = window.setTimeout(load, REFRESH_INTERVAL_MS);
      } catch (loadError) {
        if (!active) return;
        const message = loadError instanceof Error ? loadError.message : "boatLocationFailed";
        setError(message);
        if (!message.includes("expired")) timer = window.setTimeout(load, REFRESH_INTERVAL_MS);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  const hasCoordinates = location?.latitude !== undefined && location?.longitude !== undefined;
  const recordedAt = location?.coordinatesRecordedAtUtc
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" })
        .format(new Date(location.coordinatesRecordedAtUtc))
    : null;

  return (
    <section className="mt-[17px] overflow-hidden rounded-xl border border-white/20 bg-white/[.06]" aria-labelledby="boatLocationTitle">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 min-[1200px]:px-6">
        <div>
          <h2 id="boatLocationTitle" className="m-0 flex items-center gap-2 font-montserrat text-[16px] font-bold text-white min-[1200px]:text-[clamp(22px,1.4vw,30px)]">
            <MapPin size={18} className="text-[#5cefdc]" aria-hidden="true" />{t('boatLocation')}</h2>
          <p className="mt-1 mb-0 font-poppins text-[9px] text-[#d0d0d0] min-[1200px]:text-sm" role="status">
            {loading ? t('loadingGps') : translateMessage(error || location?.message)}
          </p>
          {location && (
            <p className="mt-1 mb-0 font-poppins text-[8px] font-semibold text-white min-[1200px]:text-xs">
              {location.boatName} · {location.registrationNumber}
            </p>
          )}
        </div>
        {location && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-poppins text-[8px] font-semibold ${location.trackerStatus === "Online" ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-[#d0d0d0]"}`}>
            {location.shouldRefresh && <RefreshCw size={11} aria-hidden="true" />}
            {displayValue(location.tripStatus)} · {displayValue(location.trackerStatus)}
          </span>
        )}
      </div>

      {hasCoordinates && location ? (
        <div className="relative h-[260px] w-full min-[600px]:h-[320px]" aria-label={t('mapShowing', { boat: location.boatName })}>
          <Map
            key={`${locale}-${location.latitude}-${location.longitude}`}
            locale={{
              'Map.Title': t('map'),
              'Marker.Title': t('mapMarker'),
              'AttributionControl.ToggleAttribution': t('mapAttribution'),
              'AttributionControl.MapFeedback': t('mapFeedback'),
              'LogoControl.Title': t('mapLogo'),
            }}
            initialViewState={{ longitude: location.longitude!, latitude: location.latitude!, zoom: 14 }}
            mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
          >
            <Marker longitude={location.longitude!} latitude={location.latitude!} anchor="center">
              <div className="grid h-11 w-11 place-items-center rounded-full border-4 border-white bg-[#0f766e] text-white shadow-xl" title={location.boatName}>
                <Ship
                  size={21}
                  style={{ transform: `rotate(${location.headingDegrees ?? 0}deg)` }}
                  aria-hidden="true"
                />
              </div>
            </Marker>
          </Map>
        </div>
      ) : !loading && (
        <div className="grid min-h-32 place-items-center border-t border-white/10 px-6 py-8 text-center">
          <div>
            <Compass className="mx-auto text-[#5cefdc]" size={28} aria-hidden="true" />
            <p className="mt-3 mb-0 font-poppins text-xs text-[#d0d0d0]">{translateMessage(error || location?.message) || t('noGps')}</p>
          </div>
        </div>
      )}

      {recordedAt && (
        <p className="m-0 border-t border-white/10 px-4 py-3 font-poppins text-[8px] text-[#bcbcbc] min-[1200px]:px-6 min-[1200px]:text-xs">
          {t('positionRecorded', { date: recordedAt })}
        </p>
      )}
    </section>
  );
}

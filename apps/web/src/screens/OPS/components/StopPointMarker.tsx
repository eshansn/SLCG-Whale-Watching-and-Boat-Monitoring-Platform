import { useEffect, useState, type ReactNode } from "react";
import { Clock3, MapPin, Pause, X } from "lucide-react";
import { Marker, Popup } from "react-map-gl/maplibre";

import type { TripStop } from "../../../operations/operationsApi";

interface StopPointMarkerProps {
  markerKey: string;
  stop: TripStop;
  number: number;
  selected: boolean;
  offset?: [number, number];
  onSelect: (key: string) => void;
  onClose: () => void;
}

export default function StopPointMarker({
  markerKey,
  stop,
  number,
  selected,
  offset,
  onSelect,
  onClose,
}: StopPointMarkerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!stop.isOngoing) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [stop.isOngoing]);

  const durationSeconds = stop.isOngoing
    ? Math.max(stop.durationSeconds, Math.floor((now - new Date(stop.startedAtUtc).getTime()) / 1_000))
    : stop.durationSeconds;
  const label = stop.isOngoing ? "Currently stopped" : `Stop ${number}`;

  return (
    <>
      <Marker
        longitude={stop.longitude}
        latitude={stop.latitude}
        anchor="center"
        offset={offset}
        onClick={(event) => {
          event.originalEvent.stopPropagation();
          onSelect(markerKey);
        }}
      >
        <button
          type="button"
          aria-label={`${label}, ${formatDuration(durationSeconds)}`}
          title={`${label} · ${formatDuration(durationSeconds)}`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(markerKey);
          }}
          onMouseEnter={() => onSelect(markerKey)}
          onFocus={() => onSelect(markerKey)}
          className="group relative grid h-11 w-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
        >
          {stop.isOngoing && (
            <span className="absolute h-9 w-9 animate-pulse rounded-full bg-orange-500/30 motion-reduce:animate-none" />
          )}
          <span className={`relative grid h-7 w-7 place-items-center rounded-full border-[3px] border-white text-[10px] font-bold text-white shadow-lg transition-transform group-hover:scale-110 ${stop.isOngoing ? "bg-orange-600 ring-2 ring-orange-300" : "bg-amber-500"}`}>
            {stop.isOngoing ? <Pause size={12} fill="currentColor" /> : number <= 99 ? number : <Pause size={12} fill="currentColor" />}
          </span>
        </button>
      </Marker>

      {selected && (
        <Popup
          longitude={stop.longitude}
          latitude={stop.latitude}
          anchor="bottom"
          offset={22}
          closeButton={false}
          closeOnClick={false}
          onClose={onClose}
          maxWidth="280px"
        >
          <section className="w-[min(230px,calc(100vw-72px))] text-[#14223d]" aria-label={`${label} details`} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${stop.isOngoing ? "bg-orange-50 text-orange-700" : "bg-amber-50 text-amber-700"}`}><MapPin size={18} /></span>
                <div className="min-w-0"><h3 className="text-sm font-bold">Stopped location</h3><p className={`mt-0.5 text-[10px] font-semibold ${stop.isOngoing ? "text-orange-700" : "text-slate-500"}`}>{label}</p></div>
              </div>
              <button type="button" onClick={(event) => { event.stopPropagation(); onClose(); }} aria-label="Close stop details" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"><X size={16} /></button>
            </div>
            <dl className="mt-2 divide-y divide-slate-100 text-[11px]">
              <Detail label="Arrival" value={formatDateTime(stop.startedAtUtc)} />
              {stop.isOngoing ? <Detail label="Status" value="Currently stopped" emphasize /> : <Detail label="Departure" value={stop.endedAtUtc ? formatDateTime(stop.endedAtUtc) : "Unavailable"} />}
              <Detail label="Duration" value={formatDuration(durationSeconds)} icon={<Clock3 size={13} />} />
              <Detail label="Speed" value={formatSpeed(stop.speedKnots)} />
              <Detail label="Coordinates" value={`${stop.latitude.toFixed(5)}, ${stop.longitude.toFixed(5)}`} mono />
            </dl>
          </section>
        </Popup>
      )}
    </>
  );
}

function Detail({ label, value, icon, emphasize = false, mono = false }: {
  label: string;
  value: string;
  icon?: ReactNode;
  emphasize?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className={`flex min-w-0 items-center gap-1 text-right font-semibold ${emphasize ? "text-orange-700" : "text-slate-700"} ${mono ? "break-all font-mono text-[10px]" : ""}`}>{icon}{value}</dd>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-LK", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes} min`;
  return "< 1 min";
}

function formatSpeed(speedKnots?: number) {
  if (speedKnots == null) return "Stationary";
  const kilometersPerHour = Math.abs(speedKnots) * 1.852;
  return `${kilometersPerHour < 0.05 ? "0" : kilometersPerHour.toFixed(1)} km/h`;
}

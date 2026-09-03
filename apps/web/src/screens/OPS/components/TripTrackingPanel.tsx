import { useEffect, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { operationsApi, type TripTrackingSummary } from "../../../operations/operationsApi";
import TripRouteMap from "./TripRouteMap";

interface TripTrackingPanelProps {
  tripId: string;
  vesselName: string;
  fallbackLatitude?: number;
  fallbackLongitude?: number;
}

export default function TripTrackingPanel({
  tripId,
  vesselName,
  fallbackLatitude,
  fallbackLongitude,
}: TripTrackingPanelProps) {
  const { session } = useAuth();
  const [summary, setSummary] = useState<TripTrackingSummary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    if (!session) return;
    let active = true;
    let timer: number | undefined;
    let requestVersion = 0;
    const load = () => {
      const currentRequest = ++requestVersion;
      void operationsApi.tripTrackingSummary(session.accessToken, tripId)
        .then((nextSummary) => {
          if (!active || currentRequest !== requestVersion) return;
          setSummary(nextSummary);
          setError("");
          if (nextSummary.status !== "Completed") timer = window.setTimeout(load, 5_000);
        })
        .catch((reason) => {
          if (!active || currentRequest !== requestVersion) return;
          setError(reason instanceof Error ? reason.message : "Unable to load trip tracking information.");
          timer = window.setTimeout(load, 10_000);
        })
        .finally(() => { if (active && currentRequest === requestVersion) setLoading(false); });
    };
    load();
    return () => { active = false; if (timer !== undefined) window.clearTimeout(timer); };
  }, [session, tripId, retryVersion]);

  const retry = () => { setLoading(true); setRetryVersion((version) => version + 1); };

  if (loading && !summary) return <section className="rounded-xl bg-white p-5 shadow-sm"><div className="h-[500px] animate-pulse rounded-xl bg-slate-100" /></section>;
  if (!summary) return <section className="rounded-xl bg-white p-5 text-center shadow-sm"><p className="text-sm text-red-600">{error || "Tracking information is unavailable."}</p><button type="button" onClick={retry} className="mt-3 text-xs font-semibold text-indigo-700 underline">Retry</button></section>;

  const insufficientTelemetry = summary.status !== "NotStarted" && summary.route.length < 2;
  const unavailableText = summary.status === "NotStarted"
    ? "Trip has not started"
    : summary.status === "Active"
      ? "Waiting for GPS data"
      : "GPS data unavailable";
  const statistics = [
    ["Route Length", summary.routeLength == null || insufficientTelemetry ? unavailableText : `${summary.routeLength.toFixed(2)} ${summary.routeLengthUnit}`],
    ["Move Duration", summary.moveDurationSeconds == null || insufficientTelemetry ? unavailableText : formatDuration(summary.moveDurationSeconds)],
    ["Stops Duration", summary.stopsDurationSeconds == null || insufficientTelemetry ? unavailableText : formatDuration(summary.stopsDurationSeconds)],
    ["Average Speed", summary.averageSpeed == null || insufficientTelemetry ? unavailableText : `${summary.averageSpeed.toFixed(1)} ${summary.speedUnit}`],
  ];

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-bold">Trip Tracking</h2><p className="mt-1 text-[10px] text-slate-500">Travelled GPS route and movement statistics</p></div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${summary.status === "Active" ? "bg-emerald-50 text-emerald-700" : summary.status === "Completed" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>{summary.status === "NotStarted" ? "Not started" : summary.status}</span>
      </div>
      {error && <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-[10px] text-red-700"><span>{error}</span><button type="button" onClick={retry} className="font-semibold underline">Retry</button></div>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(240px,1fr)]">
        <TripRouteMap summary={summary} vesselName={vesselName} fallbackLatitude={fallbackLatitude} fallbackLongitude={fallbackLongitude} />
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {statistics.map(([label, value]) => <div key={label} className="rounded-xl bg-[#f7f8fa] p-4"><dt className="text-[11px] font-semibold text-slate-500">{label}</dt><dd className={`mt-2 font-bold ${value === unavailableText ? "text-xs text-slate-500" : "text-xl text-[#14223d]"}`}>{value}</dd></div>)}
        </dl>
      </div>
    </section>
  );
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m`;
}

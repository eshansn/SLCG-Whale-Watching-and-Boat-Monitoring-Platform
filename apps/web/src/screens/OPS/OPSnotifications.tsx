import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { Icon } from "../../components/ui/icon";
import {
  connectOperations,
  formatTripDate,
  operationsApi,
  type SosAlert,
} from "../../operations/operationsApi";
import { useOperations } from "../../operations/useOperations";
import Navbar from "./components/Navbar";

const ALERT_REFRESH_INTERVAL_MS = 5000;

export default function OPSNotifications() {
  const { session } = useAuth();
  const { trips, loading, error } = useOperations();
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState("");

  useEffect(() => {
    if (!session) return;
    let active = true;
    let requestVersion = 0;
    const load = () => {
      const currentRequest = ++requestVersion;
      void operationsApi.sosAlerts(session.accessToken)
        .then((nextAlerts) => {
          if (!active || currentRequest !== requestVersion) return;
          setAlerts(nextAlerts);
          setAlertsError("");
        })
        .catch((loadError) => {
          if (!active || currentRequest !== requestVersion) return;
          setAlertsError(loadError instanceof Error ? loadError.message : "Unable to load SOS alerts.");
        })
        .finally(() => {
          if (active && currentRequest === requestVersion) setAlertsLoading(false);
        });
    };

    load();
    const interval = window.setInterval(load, ALERT_REFRESH_INTERVAL_MS);
    const disconnect = connectOperations(session.accessToken, load);
    return () => {
      active = false;
      window.clearInterval(interval);
      disconnect();
    };
  }, [session]);

  const items = useMemo(() => [
    ...alerts.map((alert) => ({
      id: `s-${alert.id}`,
      title: `SOS · ${alert.vesselName}`,
      message: `${alert.natureOfEmergency} — ${alert.location}`,
      time: alert.raisedAtUtc,
      alert: true,
    })),
    ...trips.map((trip) => ({
      id: `t-${trip.id}`,
      title: `${trip.vesselName} · ${trip.status}`,
      message: `${trip.route} · Shore ${trip.shoreApproval} · Wildlife ${trip.wildlifeShoreApproval}`,
      time: trip.updatedAtUtc,
      alert: trip.hasActiveSos,
    })),
  ].sort((left, right) => +new Date(right.time) - +new Date(left.time)), [alerts, trips]);
  const combinedError = [error, alertsError].filter(Boolean).join(" ");

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-[Poppins] text-[#14223d]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-6">
        <section className="rounded-md bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">Live operational changes and active emergency alerts.</p>
          {combinedError && <p role="alert" className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{combinedError}</p>}
          {loading || alertsLoading ? (
            <p className="py-10 text-slate-400">Loading updates…</p>
          ) : (
            <div className="mt-6 space-y-3">
              {items.map((item) => (
                <article key={item.id} className={`flex gap-3 rounded-xl border p-4 ${item.alert ? "border-red-200 bg-red-50" : "border-slate-100"}`}>
                  <div className="rounded-full bg-white p-2"><Icon name="notification" size={16} /></div>
                  <div>
                    <h2 className="text-sm font-semibold">{item.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                    <time className="mt-2 block text-xs text-slate-400">{formatTripDate(item.time)}</time>
                  </div>
                </article>
              ))}
              {!items.length && !combinedError && <p className="py-10 text-center text-slate-400">No operational updates available.</p>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

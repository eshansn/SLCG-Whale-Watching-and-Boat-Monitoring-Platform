import { useEffect, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { connectOperations, operationsApi, type TransferHistory } from "../../../operations/operationsApi";

interface TransferHistoryState {
  requestedTripId: string;
  records: TransferHistory[];
  error: string;
}

export default function TransferHistoryPanel({ tripId }: { tripId: string }) {
  const { session } = useAuth();
  const [data, setData] = useState<TransferHistoryState>({
    requestedTripId: "",
    records: [],
    error: "",
  });
  const [loading, setLoading] = useState(true);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    if (!session) return;
    let active = true;
    let requestVersion = 0;
    const load = () => {
      const currentRequest = ++requestVersion;
      void operationsApi.transferHistory(session.accessToken)
        .then((items) => {
          if (!active || currentRequest !== requestVersion) return;
          setData({
            requestedTripId: tripId,
            records: items.filter((item) => item.sourceTripId === tripId || item.destinationTripId === tripId),
            error: "",
          });
        })
        .catch((loadError) => {
          if (!active || currentRequest !== requestVersion) return;
          const message = loadError instanceof Error
            ? loadError.message
            : "Unable to load transfer history.";
          setData((current) => current.requestedTripId === tripId
            ? { ...current, error: message }
            : { requestedTripId: tripId, records: [], error: message });
        })
        .finally(() => { if (active && currentRequest === requestVersion) setLoading(false); });
    };
    load();
    const disconnect = connectOperations(session.accessToken, load);
    return () => { active = false; disconnect(); };
  }, [session, tripId, retryVersion]);

  const retry = () => {
    setLoading(true);
    setRetryVersion((version) => version + 1);
  };

  const isCurrentTrip = data.requestedTripId === tripId;
  const isLoading = loading || !isCurrentTrip;
  const records = isCurrentTrip ? data.records : [];
  const error = isCurrentTrip ? data.error : "";

  if (!records.length && !error && !isLoading) return null;

  return (
    <section className="mt-4 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="font-bold">Transfer History</h2>
      {error && (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          <span>{error}</span>
          <button type="button" disabled={isLoading} onClick={retry} className="shrink-0 font-semibold underline disabled:opacity-50">
            {isLoading ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}
      {isLoading && !records.length && !error && <p className="mt-4 text-xs text-slate-400">Loading transfer history…</p>}
      {!!records.length && (
        <div className="mt-4 space-y-3">
          {records.map((record) => (
            <article key={record.id} className="rounded-lg border p-4 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{record.sourceBoat} → {record.destinationBoat}</p>
                  <p className="mt-1 text-slate-500">{record.sourceRegistrationNumber} / Trip {record.sourceTripId} → {record.destinationRegistrationNumber} / Trip {record.destinationTripId}</p>
                  <p className="mt-1 text-slate-500">Owners: {record.sourceOwner} → {record.destinationOwner}</p>
                </div>
                <time className="text-slate-500">{new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.transferredAtUtc))}</time>
              </div>
              <p className="mt-3">{record.items.map((item) => `${item.personName} (${item.personType})`).join(", ")}</p>
              <p className="mt-2 text-slate-500">By {record.initiatedBy} · {record.reason}{record.explanation ? ` — ${record.explanation}` : ""} · {record.status}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

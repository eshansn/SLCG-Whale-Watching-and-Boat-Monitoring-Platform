import { useEffect, useState } from "react";
import { ArrowRightLeft, Search, X } from "lucide-react";
import {
  operationsApi,
  type TransferBoat,
  type TransferOptions,
  type TransferResult,
  type TransferTrip,
} from "../../operations/operationsApi";

const reasons = [
  "Boat mechanical issue",
  "Boat unavailable",
  "Operational issue",
  "Passenger redistribution",
  "Insufficient passengers",
  "Weather/operational adjustment",
  "Other",
];

interface Props {
  token: string;
  sourceTripId: string;
  onClose: () => void;
  onComplete: (result: TransferResult, destination: TransferTrip) => void;
}

export default function TripTransferModal({ token, sourceTripId, onClose, onComplete }: Props) {
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [options, setOptions] = useState<TransferOptions>();
  const [passengerIds, setPassengerIds] = useState<string[]>([]);
  const [crewIds, setCrewIds] = useState<string[]>([]);
  const [boatQuery, setBoatQuery] = useState("");
  const [boatResults, setBoatResults] = useState<TransferBoat[]>([]);
  const [selectedBoat, setSelectedBoat] = useState<TransferBoat>();
  const [destinationTrips, setDestinationTrips] = useState<TransferTrip[]>([]);
  const [destinationId, setDestinationId] = useState("");
  const [searchingBoats, setSearchingBoats] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    operationsApi.transferOptions(token, sourceTripId)
      .then((value) => { if (active) setOptions(value); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load transfer options."); });
    return () => { active = false; };
  }, [token, sourceTripId]);

  useEffect(() => {
    const query = boatQuery.trim();
    if (selectedBoat || query.length < 2) {
      setBoatResults([]);
      setSearchingBoats(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setSearchingBoats(true);
      operationsApi.searchTransferBoats(token, sourceTripId, query)
        .then((boats) => { if (active) { setBoatResults(boats); setError(""); } })
        .catch((searchError) => { if (active) setError(searchError instanceof Error ? searchError.message : "Unable to search destination boats."); })
        .finally(() => { if (active) setSearchingBoats(false); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [boatQuery, selectedBoat, sourceTripId, token]);

  const selectBoat = async (boat: TransferBoat) => {
    setSelectedBoat(boat);
    setBoatQuery(`${boat.name} · ${boat.registrationNumber}`);
    setBoatResults([]);
    setDestinationId("");
    setDestinationTrips([]);
    try {
      setLoadingTrips(true);
      setError("");
      setDestinationTrips(await operationsApi.transferBoatTrips(token, sourceTripId, boat.id));
    } catch (tripError) {
      setError(tripError instanceof Error ? tripError.message : "Unable to load destination trips.");
    } finally {
      setLoadingTrips(false);
    }
  };

  const changeBoat = () => {
    setSelectedBoat(undefined);
    setBoatQuery("");
    setDestinationTrips([]);
    setDestinationId("");
    setError("");
  };

  const destination = destinationTrips.find((item) => item.id === destinationId);
  const remaining = destination ? destination.maximumCapacity - destination.passengerCount : 0;
  const valid = Boolean(destination && passengerIds.length <= remaining &&
    (passengerIds.length || crewIds.length) && reason && (reason !== "Other" || explanation.trim()));
  const toggle = (values: string[], set: (value: string[]) => void, id: string) =>
    set(values.includes(id) ? values.filter((item) => item !== id) : [...values, id]);
  const format = (value: string) => new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));

  const submit = async () => {
    if (!valid || !destination || submitting) return;
    try {
      setSubmitting(true);
      setError("");
      const result = await operationsApi.transferPeople(token, {
        clientRequestId,
        sourceTripId,
        destinationTripId: destination.id,
        passengerIds,
        crewUserIds: crewIds,
        reason,
        explanation: explanation.trim() || undefined,
      });
      onComplete(result, destination);
    } catch (submitError) {
      setConfirming(false);
      setError(submitError instanceof Error ? submitError.message : "Transfer failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const source = options?.source;
  return <div className="fixed inset-0 z-[1200] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8">
    <section role="dialog" aria-modal="true" aria-labelledby="transfer-title" className="mx-auto w-full max-w-5xl rounded-3xl bg-white p-5 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="transfer-title" className="flex items-center gap-3 text-xl font-semibold text-[#162d54]"><ArrowRightLeft />Transfer Passengers / Crew</h2>
          {source && <>
            <p className="mt-2 text-sm text-slate-500">From {source.boatName} · {source.registrationNumber} · Trip {source.id} · {format(source.scheduledDepartureUtc)}</p>
            <p className="mt-1 text-xs text-slate-500">Owner: {source.ownerName} · Passengers: {source.passengerCount}/{source.maximumCapacity} · Crew: {source.crewCount} · Status: {source.status}</p>
          </>}
        </div>
        <button onClick={onClose} aria-label="Close transfer" className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100"><X /></button>
      </div>

      {!options && !error && <p className="py-16 text-center text-sm text-slate-500">Loading transfer options...</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {options && !confirming && <div className="mt-7 space-y-7">
        <div className="grid gap-6 lg:grid-cols-2">
          <People title="Passengers" selected={passengerIds} allIds={options.passengers.map((x) => x.id)} onAll={setPassengerIds}>
            {options.passengers.map((person) => <label key={person.id} className="grid cursor-pointer grid-cols-[24px_1fr] gap-3 border-t px-2 py-3 text-sm">
              <input type="checkbox" checked={passengerIds.includes(person.id)} onChange={() => toggle(passengerIds, setPassengerIds, person.id)} />
              <span><b>{person.name}</b><small className="block text-slate-500">{person.identificationNumber} · {person.phoneNumber}</small></span>
            </label>)}
          </People>
          <People title="Crew" selected={crewIds} allIds={options.crew.map((x) => x.id)} onAll={setCrewIds}>
            {options.crew.map((person) => <label key={person.id} className="grid cursor-pointer grid-cols-[24px_1fr] gap-3 border-t px-2 py-3 text-sm">
              <input type="checkbox" checked={crewIds.includes(person.id)} onChange={() => toggle(crewIds, setCrewIds, person.id)} />
              <span><b>{person.name}</b><small className="block text-slate-500">{person.position} · {person.email}</small><small className="block text-slate-400">Crew ID: {person.id}</small></span>
            </label>)}
          </People>
        </div>

        <section>
          <h3 className="font-semibold">Destination Boat</h3>
          <label className="relative mt-3 block">
            <span className="sr-only">Search Destination Boat</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={boatQuery} disabled={Boolean(selectedBoat)} onChange={(event) => { setBoatQuery(event.target.value); setBoatResults([]); setError(""); }}
              placeholder="Search boat name, registration number, or boat ID..."
              className="h-12 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm outline-none focus:border-[#162d54] disabled:bg-slate-50" />
          </label>
          {!selectedBoat && boatQuery.trim().length < 2 && <p className="mt-2 text-xs text-slate-500">Enter at least 2 characters. Boats are searched securely on the server.</p>}
          {searchingBoats && <p className="mt-3 text-sm text-slate-500">Searching registered boats...</p>}
          {!selectedBoat && boatQuery.trim().length >= 2 && !searchingBoats && boatResults.length === 0 && <p className="mt-3 text-sm text-slate-500">No approved registered boats match this search.</p>}
          {!selectedBoat && boatResults.length > 0 && <div className="mt-3 overflow-hidden rounded-xl border">
            {boatResults.map((boat) => <button key={boat.id} type="button" onClick={() => void selectBoat(boat)} className="flex w-full items-center justify-between gap-4 border-t px-4 py-3 text-left first:border-t-0 hover:bg-slate-50">
              <span><b className="block text-sm">{boat.name}</b><small className="text-slate-500">{boat.registrationNumber} · Boat ID {boat.id}</small></span>
              <span className="text-right"><small className="block font-semibold text-emerald-700">{boat.status}</small><small className="text-slate-500">Owner: {boat.ownerName}</small></span>
            </button>)}
          </div>}

          {selectedBoat && <div className="mt-4 rounded-xl border border-[#162d54] bg-blue-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected Destination Boat</p><p className="mt-1 font-semibold">{selectedBoat.name}</p><p className="text-xs text-slate-600">{selectedBoat.registrationNumber} · Owner: {selectedBoat.ownerName} · {selectedBoat.status}</p></div>
              <button type="button" onClick={changeBoat} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">Change boat</button>
            </div>
          </div>}
        </section>

        {selectedBoat && <section>
          <h3 className="font-semibold">Available Scheduled Trips</h3>
          {loadingTrips && <p className="mt-3 text-sm text-slate-500">Loading eligible trips...</p>}
          {!loadingTrips && destinationTrips.length === 0 && <p className="mt-3 text-sm text-amber-700">This boat has no eligible destination trips.</p>}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {destinationTrips.map((item) => {
              const spaces = item.maximumCapacity - item.passengerCount;
              const insufficient = passengerIds.length > spaces;
              return <label key={item.id} className={`rounded-xl border p-4 ${insufficient ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${destinationId === item.id ? "border-[#162d54] bg-blue-50" : "border-slate-200"}`}>
                <input className="mr-2" type="radio" name="destination" value={item.id} checked={destinationId === item.id} disabled={insufficient} onChange={() => setDestinationId(item.id)} />
                <b>Trip {item.id}</b>
                <p className="mt-1 text-xs text-slate-500">{format(item.scheduledDepartureUtc)} · {item.status}</p>
                <p className="mt-2 text-xs">Passengers: {item.passengerCount}/{item.maximumCapacity} · Available: {spaces} · Crew: {item.crewCount}</p>
                {insufficient && <p className="mt-2 text-xs font-semibold text-red-600">Only {Math.max(0, spaces)} passenger spaces are available.</p>}
              </label>;
            })}
          </div>
        </section>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Reason<select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 h-11 w-full rounded-lg border px-3 font-normal"><option value="">Select reason</option>{reasons.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm font-semibold">Explanation {reason !== "Other" && "(optional)"}<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} className="mt-2 h-20 w-full rounded-lg border p-3 font-normal" maxLength={1000} /></label>
        </div>
        <div className="flex items-center justify-between gap-4 border-t pt-5"><p className="text-sm text-slate-600">{passengerIds.length} passengers selected · {crewIds.length} crew selected</p><button disabled={!valid} onClick={() => setConfirming(true)} className="rounded-lg bg-[#162d54] px-6 py-3 text-sm font-semibold text-white disabled:opacity-40">Review Transfer</button></div>
      </div>}

      {options && confirming && destination && <div className="mt-7">
        <div className="rounded-2xl bg-slate-50 p-6">
          <h3 className="text-lg font-semibold">Confirm transfer</h3>
          <p className="mt-3 text-sm leading-6">You are about to transfer <b>{passengerIds.length} passengers</b> and <b>{crewIds.length} crew members</b> from <b>{options.source.boatName}</b> to <b>{destination.boatName}</b>. Their active trip and boat association will be updated.</p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-400">From</dt><dd className="font-semibold">{options.source.boatName} · Trip {options.source.id} · {format(options.source.scheduledDepartureUtc)}</dd><dd className="text-xs text-slate-500">Owner: {options.source.ownerName}</dd></div>
            <div><dt className="text-slate-400">To</dt><dd className="font-semibold">{destination.boatName} · Trip {destination.id} · {format(destination.scheduledDepartureUtc)}</dd><dd className="text-xs text-slate-500">Owner: {destination.ownerName}</dd></div>
            <div><dt className="text-slate-400">Reason</dt><dd>{reason}{explanation && ` — ${explanation}`}</dd></div>
            <div><dt className="text-slate-400">People</dt><dd>{[...options.passengers.filter((x) => passengerIds.includes(x.id)), ...options.crew.filter((x) => crewIds.includes(x.id))].map((x) => x.name).join(", ")}</dd></div>
          </dl>
        </div>
        <div className="mt-5 flex justify-end gap-3"><button disabled={submitting} onClick={() => setConfirming(false)} className="rounded-lg border px-5 py-3 text-sm">Cancel</button><button disabled={submitting} onClick={() => void submit()} className="rounded-lg bg-[#162d54] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Transferring..." : "Confirm Transfer"}</button></div>
      </div>}
    </section>
  </div>;
}

function People({ title, selected, allIds, onAll, children }: { title: string; selected: string[]; allIds: string[]; onAll: (ids: string[]) => void; children: React.ReactNode }) {
  const all = allIds.length > 0 && selected.length === allIds.length;
  return <section className="max-h-80 overflow-y-auto rounded-xl border"><div className="sticky top-0 flex items-center justify-between bg-white p-4"><h3 className="font-semibold">{title} ({selected.length} selected)</h3><button onClick={() => onAll(all ? [] : allIds)} className="text-xs font-semibold text-indigo-700">{all ? "Clear all" : "Select all"}</button></div>{children}{!allIds.length && <p className="border-t p-5 text-sm text-slate-500">No {title.toLowerCase()} assigned.</p>}</section>;
}

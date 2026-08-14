import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import {
  connectOperations,
  operationsApi,
  type Boat,
  type SosAction,
  type SosAlert,
  type Trip,
  type TripPassenger,
  type VesselMapRecord,
} from "../../../operations/operationsApi";
import TripStatusMap from "./TripStatusMap";
import TransferHistoryPanel from "./TransferHistoryPanel";

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-[115px_1fr] gap-2">
    <dt className="font-semibold">{label}</dt>
    <dd className="text-indigo-900">{value}</dd>
  </div>
);

function useTripEmergency(tripId: string) {
  const { session } = useAuth();
  const [emergency, setEmergency] = useState<SosAlert | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const load = () => void operationsApi.sosAlerts(session.accessToken)
      .then((items) => { if (active) setEmergency(items.find((item) => item.tripId === tripId) ?? null); })
      .catch(() => undefined);
    load();
    const interval = window.setInterval(load, 5000);
    const disconnect = connectOperations(session.accessToken, load);
    return () => { active = false; window.clearInterval(interval); disconnect(); };
  }, [session, tripId]);

  return emergency;
}

interface TripData {
  requestedTripId: string;
  trip?: Trip;
  boat?: Boat;
  vessel?: VesselMapRecord;
  passengers: TripPassenger[];
}

function useTripData(tripId: string) {
  const { session } = useAuth();
  const [data, setData] = useState<TripData>({ requestedTripId: "", passengers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    let active = true;
    const load = () => void Promise.all([
      operationsApi.tripPassengers(session.accessToken, tripId),
      operationsApi.trips(session.accessToken),
      operationsApi.boats(session.accessToken),
      operationsApi.vesselMap(session.accessToken),
    ]).then(([passengers, trips, boats, vessels]) => {
      if (!active) return;
      const trip = trips.find((item) => item.id === tripId);
      setData({
        requestedTripId: tripId,
        trip,
        boat: boats.find((item) => item.id === trip?.boatId),
        vessel: vessels.find((item) => item.id === trip?.boatId),
        passengers,
      });
      setError("");
    }).catch((reason) => {
      if (!active) return;
      setData({ requestedTripId: tripId, passengers: [] });
      setError(reason instanceof Error ? reason.message : "Unable to load trip information.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    load();
    const interval = window.setInterval(load, 10000);
    const disconnect = connectOperations(session.accessToken, load);
    return () => { active = false; window.clearInterval(interval); disconnect(); };
  }, [session, tripId]);

  const isCurrentTrip = data.requestedTripId === tripId;
  return {
    trip: isCurrentTrip ? data.trip : undefined,
    boat: isCurrentTrip ? data.boat : undefined,
    vessel: isCurrentTrip ? data.vessel : undefined,
    passengers: isCurrentTrip ? data.passengers : [],
    loading: loading || !isCurrentTrip,
    error: isCurrentTrip ? error : "",
  };
}

function useTripActions(tripId: string) {
  const { session } = useAuth();
  const [actions, setActions] = useState<SosAction[]>([]);
  const reload = useCallback(async () => {
    if (!session) return;
    setActions(await operationsApi.sosActions(session.accessToken, tripId));
  }, [session, tripId]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const load = () => void operationsApi.sosActions(session.accessToken, tripId)
      .then((items) => { if (active) setActions(items); })
      .catch(() => undefined);
    load();
    const interval = window.setInterval(load, 10000);
    const disconnect = connectOperations(session.accessToken, load);
    return () => { active = false; window.clearInterval(interval); disconnect(); };
  }, [session, tripId]);

  return { actions, reload };
}

export default function TripOverview({ tripId }: { tripId: string }) {
  const { session } = useAuth();
  const emergency = useTripEmergency(tripId);
  const { trip, boat, vessel, passengers, loading, error } = useTripData(tripId);
  const { actions, reload: reloadActions } = useTripActions(tripId);
  const [query, setQuery] = useState("");
  const [actionDetails, setActionDetails] = useState("");
  const [savingAction, setSavingAction] = useState(false);
  const [actionError, setActionError] = useState("");
  const canAddAction = session?.roles.includes("OPS") ?? false;
  const crew = trip?.crew ?? [];
  const ongoing = trip?.status === "Ongoing";
  const visible = useMemo(
    () => passengers.filter((passenger) => `${passenger.name} ${passenger.identificationNumber}`.toLowerCase().includes(query.toLowerCase())),
    [passengers, query],
  );

  const submitAction = async () => {
    if (!session || !actionDetails.trim() || savingAction) return;
    setSavingAction(true);
    setActionError("");
    try {
      await operationsApi.addSosAction(session.accessToken, tripId, actionDetails.trim());
      setActionDetails("");
      await reloadActions();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Unable to save the action.");
    } finally {
      setSavingAction(false);
    }
  };

  if (loading) return <main className="mx-auto max-w-[1440px] px-5 py-12 text-center text-sm text-slate-500">Loading trip information…</main>;
  if (error && !trip) return <main className="mx-auto max-w-[1440px] px-5 py-12 text-center text-sm text-red-600">{error}</main>;
  if (!trip) return <main className="mx-auto max-w-[1440px] px-5 py-12 text-center text-sm text-slate-500">Trip not found.</main>;

  const approvals = [
    ["Certifications", boat?.approval ?? vessel?.certificationApproval ?? "Pending"],
    ["Inspection", trip.shoreApproval],
    ["Wildlife", trip.wildlifeShoreApproval],
  ];

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-5">
      <div className="grid items-start gap-3 xl:grid-cols-[315px_minmax(0,1fr)_300px]">
        <VesselCard trip={trip} boat={boat} vessel={vessel} passengers={passengers} />
        <div className="min-w-0 space-y-3">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold">Passengers</h2>
              <label className="relative">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="h-8 w-40 rounded bg-slate-50 pl-7 text-[10px]" />
              </label>
            </div>
            <Table heads={["Name", "NIC or Passport", "Age", "Nationality"]} rows={visible.map((passenger) => [passenger.name, passenger.identificationNumber, formatValue(passenger.ageCategory), formatValue(passenger.passengerType)])} />
          </Card>
          <Card>
            <div className="flex justify-between"><h2 className="font-bold">Crew</h2><select className="rounded bg-slate-50 px-3 text-[10px]"><option>Sort by: Name</option><option>Sort by: Role</option></select></div>
            <Table heads={["Name", "NIC", "Role", "Certified"]} rows={crew.map((member) => [member.name, member.nicNumber ?? "–", member.position, member.certified ? "Yes" : "No"])} />
          </Card>
        </div>
        <div className="space-y-3">
          <Card>
            <h2 className="mb-3 font-bold">Approvals</h2>
            {approvals.map(([label, value]) => <div key={label} className="mt-2 flex justify-between text-[10px]"><b>{label}</b><span className={approvalTone(value)}>{value}</span></div>)}
          </Card>
          <Card>
            <h2 className="mb-3 font-bold">Emergencies</h2>
            <div className="flex justify-between gap-3 text-[10px]"><b>Nature of Emergency</b><span className={emergency ? "text-right text-red-500" : "text-emerald-500"}>{emergency?.natureOfEmergency ?? "None"}</span></div>
            <div className="mt-2 flex justify-between text-[10px]"><b>Reported Time</b><span>{emergency ? formatActionTime(emergency.raisedAtUtc, "medium") : "–"}</span></div>
            <h3 className="mt-4 font-bold">Actions Taken</h3>
            {actions.length ? (
              <ol className="mt-2 max-h-44 space-y-2 overflow-y-auto">
                {actions.map((action) => <li key={action.id} className="rounded-lg bg-slate-50 p-2.5 text-[10px]"><p className="whitespace-pre-wrap leading-4 text-slate-700">{action.details}</p><p className="mt-1 text-[9px] text-slate-400">{action.takenByName} · {formatActionTime(action.takenAtUtc, "short")}</p></li>)}
              </ol>
            ) : <p className="mt-2 rounded-lg bg-slate-50 p-3 text-[10px] text-slate-400">No response actions have been recorded.</p>}
            {canAddAction && <>
              <textarea value={actionDetails} onChange={(event) => setActionDetails(event.target.value)} maxLength={1000} disabled={!emergency || savingAction} placeholder={emergency ? "Record the response action taken" : "An active SOS is required"} className="mt-3 h-16 w-full resize-none border-y border-dashed p-2 text-[10px] disabled:bg-slate-50" />
              {actionError && <p role="alert" className="mt-2 text-[10px] text-red-600">{actionError}</p>}
              <button type="button" onClick={() => void submitAction()} disabled={!emergency || !actionDetails.trim() || savingAction} className="mt-2 w-full rounded bg-red-500 py-2 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{savingAction ? "Saving…" : "Submit"}</button>
            </>}
          </Card>
          <div className="h-[300px] rounded-xl bg-white p-2 shadow-sm"><TripStatusMap ongoing={ongoing} vesselName={trip.vesselName} latitude={vessel?.latitude} longitude={vessel?.longitude} /></div>
        </div>
      </div>
      <TransferHistoryPanel tripId={tripId} />
    </main>
  );
}

function VesselCard({ trip, boat, vessel, passengers }: { trip: Trip; boat?: Boat; vessel?: VesselMapRecord; passengers: TripPassenger[] }) {
  const lifeSavers = trip.crew.filter((member) => member.position.toLowerCase().includes("life saver")).length;
  const divers = trip.crew.filter((member) => member.position.toLowerCase().includes("diver")).length;
  const children = passengers.filter((passenger) => passenger.ageCategory === "child" || passenger.ageCategory === "small").length;
  const specialNeeds = passengers.filter((passenger) => passenger.ageCategory === "specialneeds").length;
  const coordinates = vessel?.latitude != null && vessel.longitude != null
    ? `${vessel.latitude.toFixed(6)}, ${vessel.longitude.toFixed(6)}`
    : "Location unavailable";
  const certification = boat?.approval ?? vessel?.certificationApproval ?? "Pending";
  const groups = [
    ["Vessel Information", [["Length", `${boat?.lengthMeters ?? vessel?.lengthMeters ?? 0} M`], ["Beam (Width)", `${boat?.widthMeters ?? vessel?.beamMeters ?? 0} M`], ["Cruising Speed", vessel?.cruisingSpeedKnots == null ? "No GPS reading" : `${vessel.cruisingSpeedKnots} Knots`], ["Maximum Speed", `${boat?.maximumSpeedKnots ?? vessel?.maximumSpeedKnots ?? 0} Knots`], ["Maximum Capacity", `${boat?.maximumCapacity ?? vessel?.maximumCapacity ?? 0} Passengers`], ["Life Jackets", String(boat?.lifeJacketCount ?? vessel?.lifeJacketCount ?? 0)]]],
    ["Crew Information", [["Life Savers", formatCount(lifeSavers)], ["Divers", formatCount(divers)]]],
    ["Passenger Information", [["Passengers Onboard", formatCount(trip.passengerCount)], ["Children Onboard", formatCount(children)], ["Special Needs", formatCount(specialNeeds)]]],
  ];
  return <aside className="overflow-hidden rounded-xl bg-white shadow-md"><img src={boat?.imageUrl ?? vessel?.imageUrl ?? "/gallery-2.jpg"} className="h-40 w-full object-cover" alt={`${trip.vesselName} boat`} /><div className="p-4"><h1 className="text-xl font-bold">{trip.vesselName} ⓘ</h1><div className="flex gap-3 text-[10px]"><span>{trip.registrationNumber}</span><span className={approvalTone(certification)}>{certification}</span></div><dl className="mt-4 space-y-1 text-[11px]"><Info label="Coordinates" value={coordinates} /><Info label="Departure" value={formatTripTime(trip.actualDepartureUtc ?? trip.scheduledDepartureUtc)} /><Info label="Arrival" value={trip.actualArrivalUtc ? formatTripTime(trip.actualArrivalUtc) : "TBA"} /></dl>{groups.map(([title, items]) => <section key={title as string} className="mt-4 rounded-lg bg-[#f7f8fa] p-3"><h2 className="mb-2 text-xs font-bold">{title as string}</h2><dl className="space-y-1 text-[10px]">{(items as string[][]).map(([label, value]) => <Info key={label} label={label} value={value} />)}</dl></section>)}</div></aside>;
}

function Card({ children }: { children: React.ReactNode }) { return <section className="rounded-xl bg-white p-5 shadow-sm">{children}</section>; }
function Table({ heads, rows }: { heads: string[]; rows: string[][] }) { return <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[480px] table-fixed text-left text-[10px]"><thead><tr className="border-b">{heads.map((head) => <th key={head} className="px-5 py-4 font-medium">{head}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-slate-100">{row.map((value, cellIndex) => <td key={cellIndex} className="px-5 py-5">{value}</td>)}</tr>)}</tbody></table></div>; }
function formatValue(value: string) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : "–"; }
function formatActionTime(value: string, timeStyle: "short" | "medium") { return new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle }).format(new Date(value)); }
function formatTripTime(value: string) { return new Intl.DateTimeFormat("en-LK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value)); }
function formatCount(value: number) { return value.toString().padStart(2, "0"); }
function approvalTone(value: string) { return value === "Approved" ? "text-emerald-500" : value === "Rejected" ? "text-red-500" : "text-amber-500"; }

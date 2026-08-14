import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import {
  connectOperations,
  operationsApi,
  type SosAction,
  type SosAlert,
  type TripCrew,
  type TripPassenger,
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

function useTripPeople(tripId: string) {
  const { session } = useAuth();
  const [passengers, setPassengers] = useState<TripPassenger[]>([]);
  const [crew, setCrew] = useState<TripCrew[]>([]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const load = () => void Promise.all([
      operationsApi.tripPassengers(session.accessToken, tripId),
      operationsApi.trips(session.accessToken),
    ]).then(([people, trips]) => {
      if (!active) return;
      setPassengers(people);
      setCrew(trips.find((trip) => trip.id === tripId)?.crew ?? []);
    }).catch(() => undefined);
    load();
    const interval = window.setInterval(load, 10000);
    const disconnect = connectOperations(session.accessToken, load);
    return () => { active = false; window.clearInterval(interval); disconnect(); };
  }, [session, tripId]);

  return { passengers, crew };
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
  const ongoing = tripId === "1" || tripId === "101";
  const emergency = useTripEmergency(tripId);
  const { passengers, crew } = useTripPeople(tripId);
  const { actions, reload: reloadActions } = useTripActions(tripId);
  const [query, setQuery] = useState("");
  const [actionDetails, setActionDetails] = useState("");
  const [savingAction, setSavingAction] = useState(false);
  const [actionError, setActionError] = useState("");
  const canAddAction = session?.roles.includes("OPS") ?? false;
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

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-5">
      <div className="grid items-start gap-3 xl:grid-cols-[315px_minmax(0,1fr)_300px]">
        <VesselCard ongoing={ongoing} />
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
            {[["Certifications", "Approved"], ["Inspection", "Approved"], ["Wildlife", "Approved"]].map(([label, value]) => <div key={label} className="mt-2 flex justify-between text-[10px]"><b>{label}</b><span className="text-emerald-500">{value}</span></div>)}
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
          <div className="h-[300px] rounded-xl bg-white p-2 shadow-sm"><TripStatusMap ongoing={ongoing} /></div>
        </div>
      </div>
      <TransferHistoryPanel tripId={tripId} />
    </main>
  );
}

function VesselCard({ ongoing }: { ongoing: boolean }) {
  const groups = [
    ["Vessel Information", [["Length", "12.8 M"], ["Beam (Width)", "3.9 M"], ["Cruising Speed", "20 Knots"], ["Maximum Speed", "28 Knots"], ["Maximum Capacity", "35 Passengers"], ["Life Jackets", "37"]]],
    ["Crew Information", [["Life Savers", "03"], ["Divers", "02"]]],
    ["Passenger Information", [["Passengers Onboard", "24"], ["Children Onboard", "03"], ["Special Needs", "00"]]],
  ];
  return <aside className="overflow-hidden rounded-xl bg-white shadow-md"><img src="/gallery-2.jpg" className="h-40 w-full object-cover" alt="Whale watching boat" /><div className="p-4"><h1 className="text-xl font-bold">FV Mirissa King ⓘ</h1><div className="flex gap-3 text-[10px]"><span>SL-WB-2047</span><span className="text-emerald-500">Certified</span></div><dl className="mt-4 space-y-1 text-[11px]"><Info label="Coordinates" value="5.949186, 80.438509" /><Info label="Departure" value="06:32:11 Hrs" /><Info label="Arrival" value={ongoing ? "TBA" : "11:48:02 Hrs"} /></dl>{groups.map(([title, items]) => <section key={title as string} className="mt-4 rounded-lg bg-[#f7f8fa] p-3"><h2 className="mb-2 text-xs font-bold">{title as string}</h2><dl className="space-y-1 text-[10px]">{(items as string[][]).map(([label, value]) => <Info key={label} label={label} value={value} />)}</dl></section>)}</div></aside>;
}

function Card({ children }: { children: React.ReactNode }) { return <section className="rounded-xl bg-white p-5 shadow-sm">{children}</section>; }
function Table({ heads, rows }: { heads: string[]; rows: string[][] }) { return <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[480px] table-fixed text-left text-[10px]"><thead><tr className="border-b">{heads.map((head) => <th key={head} className="px-5 py-4 font-medium">{head}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-slate-100">{row.map((value, cellIndex) => <td key={cellIndex} className="px-5 py-5">{value}</td>)}</tr>)}</tbody></table></div>; }
function formatValue(value: string) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : "–"; }
function formatActionTime(value: string, timeStyle: "short" | "medium") { return new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle }).format(new Date(value)); }

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy, Download, Mic, Play, Search, Square } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Map, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useParams } from "react-router-dom";
import {
  operationsApi,
  type TripPassenger,
  type VesselMapRecord,
} from "../../operations/operationsApi";
import { useOperations } from "../../operations/useOperations";
import { CrewLayout, State } from "./components/CrewLayout";
import { CrewSOSButton } from "./components/CrewSOSButton";
import {
  getCrewAttendance,
  type CrewAttendanceManifest,
  type CrewAttendanceStatus,
} from "./crewAttendanceApi";

export default function BoatCrewTripDetails() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trips, loading, error, token } = useOperations();
  const trip = trips.find((item) => item.id === tripId);
  const [passengers, setPassengers] = useState<TripPassenger[]>([]);
  const [passengerError, setPassengerError] = useState("");
  const [attendance, setAttendance] = useState<CrewAttendanceManifest>();
  const [attendanceError, setAttendanceError] = useState("");
  const [vessel, setVessel] = useState<VesselMapRecord | null>(null);
  const [mapError, setMapError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [startingTrip, setStartingTrip] = useState(false);
  const [startError, setStartError] = useState("");

  useEffect(() => {
    if (!token || !trip?.id) return;
    let active = true;
    let requestInFlight = false;
    const load = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const [passengerResult, attendanceResult] = await Promise.allSettled([
          operationsApi.tripPassengers(token, trip.id),
          getCrewAttendance(token, trip.id),
        ]);
        if (!active) return;

        if (passengerResult.status === "fulfilled") {
          setPassengers(passengerResult.value);
          setPassengerError("");
        } else {
          setPassengerError(
            passengerResult.reason instanceof Error
              ? passengerResult.reason.message
              : "Unable to load passenger information.",
          );
        }

        if (attendanceResult.status === "fulfilled") {
          setAttendance(attendanceResult.value);
          setAttendanceError("");
        } else {
          setAttendanceError(
            attendanceResult.reason instanceof Error
              ? attendanceResult.reason.message
              : "Unable to load attendance information.",
          );
        }
      } finally {
        requestInFlight = false;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token, trip?.id, trip?.updatedAtUtc]);

  useEffect(() => {
    if (!token || !trip?.boatId) return;
    let active = true;
    let requestInFlight = false;
    const load = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const vessels = await operationsApi.vesselMap(token);
        if (active) {
          setVessel(vessels.find((item) => item.id === trip.boatId) ?? null);
          setMapError("");
        }
      } catch (reason) {
        if (active) {
          setMapError(
            reason instanceof Error
              ? reason.message
              : "Unable to load live vessel location.",
          );
        }
      } finally {
        requestInFlight = false;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token, trip?.boatId]);

  const rows = useMemo(
    () =>
      passengers
        .filter((passenger) =>
          `${passenger.name} ${passenger.identificationNumber} ${passenger.passengerType}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .sort((first, second) =>
          sort === "age"
            ? first.ageCategory.localeCompare(second.ageCategory)
            : sort === "passengerType"
              ? first.passengerType.localeCompare(second.passengerType)
              : first.name.localeCompare(second.name),
        ),
    [passengers, search, sort],
  );

  if (loading) {
    return (
      <CrewLayout title="Trip Info">
        <State>Loading trip information...</State>
      </CrewLayout>
    );
  }
  if (error || !trip) {
    return (
      <CrewLayout title="Trip Info">
        <State tone="error">{error || "Trip not found."}</State>
      </CrewLayout>
    );
  }

  const invitationUrl = trip.invitationCode
    ? `${location.origin}/passenger/trip/${trip.invitationCode}`
    : "";
  const statuses = new globalThis.Map<string, CrewAttendanceStatus>(
    attendance?.passengers.map((item) => [item.passengerId, item.status]) ?? [],
  );
  const summary = attendance?.summary ?? {
    present: 0,
    notPresent: 0,
    notChecked: passengers.length,
    total: passengers.length,
  };

  const copy = async () => {
    if (invitationUrl) await navigator.clipboard.writeText(invitationUrl);
  };
  const download = () => {
    const svg = document.getElementById("crew-trip-qr");
    if (!svg) return;
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svg)], {
        type: "image/svg+xml",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `trip-${trip.registrationNumber}-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const startTrip = async () => {
    if (!token || startingTrip) return;
    const isOngoing = trip.status === "Ongoing";
    setStartingTrip(true);
    setStartError("");
    try {
      await operationsApi.status(token, trip.id, isOngoing ? "Completed" : "Ongoing");
    } catch (reason) {
      setStartError(
        reason instanceof Error
          ? reason.message
          : `Unable to ${isOngoing ? "end" : "start"} this trip.`,
      );
    } finally {
      setStartingTrip(false);
    }
  };

  return (
    <CrewLayout title="Trip Info">
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 sm:px-7 lg:px-10">
        <section className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-10 lg:grid-cols-[280px_minmax(0,320px)] lg:justify-center">
          <div>
            <Label label="Boat" value={trip.vesselName} />
            <Label
              label="Time"
              value={new Intl.DateTimeFormat("en-LK", {
                timeStyle: "short",
              }).format(new Date(trip.scheduledDepartureUtc))}
            />
            <Label
              label="Date"
              value={new Intl.DateTimeFormat("en-LK", {
                dateStyle: "full",
              }).format(new Date(trip.scheduledDepartureUtc))}
            />
            <p className="mt-2 text-[9px] font-semibold uppercase text-emerald-500">
              ● {trip.shoreApproval}
            </p>
          </div>
          <div className="justify-self-end text-center">
            {invitationUrl ? (
              <QRCodeSVG
                id="crew-trip-qr"
                value={invitationUrl}
                size={280}
                level="H"
                marginSize={2}
                className="aspect-square h-auto w-full max-w-[280px]"
              />
            ) : (
              <p className="text-sm text-slate-500">QR invitation unavailable.</p>
            )}
            {invitationUrl && (
              <div className="mt-3 flex justify-center gap-2">
                <button
                  onClick={() => void copy()}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"
                >
                  <Copy size={15} />Copy link
                </button>
                <button
                  onClick={download}
                  className="flex items-center gap-2 rounded-lg bg-[#162d54] px-3 py-2 text-xs font-semibold text-white"
                >
                  <Download size={15} />Download QR
                </button>
              </div>
            )}
          </div>
        </section>

        {(trip.status === "Scheduled" ||
          trip.status === "Boarding" ||
          trip.status === "Ongoing") && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              disabled={startingTrip}
              onClick={() => void startTrip()}
              className="flex min-h-11 items-center gap-2 rounded-lg bg-[#162d54] px-6 py-3 text-sm font-semibold text-white hover:bg-[#203d6c] disabled:opacity-50"
            >
              {trip.status === "Ongoing" ? <Square size={18} /> : <Play size={18} />}
              {startingTrip
                ? trip.status === "Ongoing"
                  ? "Ending..."
                  : "Starting..."
                : trip.status === "Ongoing"
                  ? "End Trip"
                  : "Start Trip"}
            </button>
            {startError && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {startError}
              </p>
            )}
          </div>
        )}

        <AttendanceSummary
          manifest={attendance}
          summary={summary}
          error={attendanceError}
        />

        <section className="mt-7">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold sm:text-2xl">Passenger Info</h1>
            <span className="rounded-full bg-[#162d54] px-3 py-1 text-xs font-semibold text-white">
              {passengers.length} registered
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="h-10 w-full rounded-lg pl-10 text-sm outline-none focus:bg-slate-50"
              />
            </div>
            <button
              aria-label="Voice search"
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100"
            >
              <Mic size={17} />
            </button>
            <div className="relative">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="h-10 appearance-none rounded-lg bg-slate-50 pl-3 pr-8 text-xs"
              >
                <option value="name">Sort by: Name</option>
                <option value="age">Sort by: Age</option>
                <option value="passengerType">Sort by: Passenger type</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2" />
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="border-b">
                  {["Name", "NIC or Passport", "Age", "Passenger type", "Attendance"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="px-2 py-3 text-left text-xs font-medium"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((passenger) => {
                  const status = statuses.get(passenger.id) ?? "NotChecked";
                  return (
                    <tr key={passenger.id} className="border-b">
                      <td
                        className={`px-2 py-4 text-xs font-semibold ${status === "Present" ? "text-emerald-600" : status === "NotPresent" ? "text-red-600" : "text-slate-700"}`}
                      >
                        {passenger.name}
                      </td>
                      <td className="px-2 py-4 text-xs">
                        {passenger.identificationNumber}
                      </td>
                      <td className="px-2 py-4 text-xs">{passenger.ageCategory}</td>
                      <td className="px-2 py-4 text-xs">
                        {passenger.passengerType}
                      </td>
                      <td className="px-2 py-4">
                        <AttendanceBadge status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {passengerError && (
              <p className="py-5 text-sm text-red-600">{passengerError}</p>
            )}
            {!passengerError && rows.length === 0 && (
              <p className="py-5 text-sm text-slate-500">
                No passengers have registered for this trip yet.
              </p>
            )}
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="px-5 py-4">
            <h2 className="font-semibold text-[#162d54]">Live vessel location</h2>
            <p className="text-xs text-slate-500">
              Updates automatically every 10 seconds
            </p>
          </div>
          {mapError ? (
            <p className="m-5 bg-red-50 p-4 text-sm text-red-700">{mapError}</p>
          ) : vessel?.latitude != null && vessel.longitude != null ? (
            <div className="h-[360px] w-full sm:h-[460px]">
              <Map
                initialViewState={{
                  longitude: vessel.longitude,
                  latitude: vessel.latitude,
                  zoom: 14,
                }}
                mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
              >
                <Marker longitude={vessel.longitude} latitude={vessel.latitude}>
                  <span className="grid h-11 w-11 place-items-center rounded-full border-4 border-white bg-[#162d54] text-white shadow-lg">
                    ▲
                  </span>
                </Marker>
              </Map>
            </div>
          ) : (
            <p className="px-5 pb-6 text-sm text-slate-500">
              No GPS location received yet.
            </p>
          )}
        </section>
      </div>
      {token && (
        <CrewSOSButton
          boatName={trip.vesselName}
          tripId={trip.id}
          token={token}
          active={trip.hasActiveSos}
        />
      )}
    </CrewLayout>
  );
}

function Label({ label, value }: { label: string; value: string }) {
  return (
    <>
      <p className="mt-2 text-base font-semibold sm:text-xl">{label}</p>
      <p className="mt-1 text-base sm:text-xl">{value}</p>
    </>
  );
}

function AttendanceSummary({
  manifest,
  summary,
  error,
}: {
  manifest?: CrewAttendanceManifest;
  summary: CrewAttendanceManifest["summary"];
  error: string;
}) {
  const percent = summary.total
    ? Math.round((summary.present / summary.total) * 100)
    : 0;
  return (
    <section className="mt-8 rounded-xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#14223d]">
            Passenger Attendance
          </h2>
          <p className="mt-1 text-sm font-semibold text-indigo-700">
            {summary.present} of {summary.total} passengers are Present
          </p>
        </div>
        {manifest?.finalizedAtUtc && (
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            Finalized{manifest.finalizedBy ? ` by ${manifest.finalizedBy}` : ""}
          </span>
        )}
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Present" value={summary.present} color="text-emerald-600" />
        <Metric label="Not Present" value={summary.notPresent} color="text-red-600" />
        <Metric label="Not Yet Checked" value={summary.notChecked} color="text-slate-500" />
        <Metric label="Total" value={summary.total} color="text-[#14223d]" />
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </section>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function AttendanceBadge({ status }: { status: CrewAttendanceStatus }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
        status === "Present"
          ? "bg-emerald-50 text-emerald-700"
          : status === "NotPresent"
            ? "bg-red-50 text-red-700"
            : "bg-slate-100 text-slate-600"
      }`}
    >
      {status === "NotPresent"
        ? "Not Present"
        : status === "NotChecked"
          ? "Not Yet Checked"
          : "Present"}
    </span>
  );
}

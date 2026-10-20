import BoatImage from "../../components/BoatImage";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Mic, Search, Square } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useParams } from "react-router-dom";
import {
  operationsApi,
  type TripPassenger,
} from "../../operations/operationsApi";
import { useOperations } from "../../operations/useOperations";
import { formatPassengerCountry } from "../../data/countries";
import { PassengerCountryDisplay } from "../../components/CountryFlag";
import { CrewLayout, State } from "./components/CrewLayout";
import { CrewSOSButton } from "./components/CrewSOSButton";
import TripTrackingPanel from "../OPS/components/TripTrackingPanel";
import {
  getCrewAttendance,
  type CrewAttendanceManifest,
  type CrewAttendanceStatus,
} from "./crewAttendanceApi";

type CopyState = "idle" | "copying" | "copied" | "error";

type CrewSpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type CrewSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  abort: () => void;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: CrewSpeechRecognitionEvent) => void) | null;
};

type CrewSpeechRecognitionWindow = {
  SpeechRecognition?: new () => CrewSpeechRecognition;
  webkitSpeechRecognition?: new () => CrewSpeechRecognition;
};

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through for browsers that expose the API but deny clipboard access.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Clipboard copy was rejected.");
    }
  } finally {
    textarea.remove();
  }
}

export default function BoatCrewTripDetails() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trips, boats, loading, error, reload, token } = useOperations();
  const trip = trips.find((item) => item.id === tripId);
  const [passengers, setPassengers] = useState<TripPassenger[]>([]);
  const [passengerError, setPassengerError] = useState("");
  const [attendance, setAttendance] = useState<CrewAttendanceManifest>();
  const [attendanceError, setAttendanceError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [startingTrip, setStartingTrip] = useState(false);
  const [startError, setStartError] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<CrewSpeechRecognition | null>(null);

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    recognition.abort();
    recognitionRef.current = null;
  }, []);

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

  const rows = useMemo(
    () =>
      passengers
        .filter((passenger) =>
          `${passenger.name} ${passenger.identificationNumber} ${formatPassengerCountry(passenger.passengerType, passenger.countryCode)}`
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
    if (!invitationUrl || copyState === "copying") return;
    setCopyState("copying");
    try {
      await copyText(invitationUrl);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
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
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    }
  };
  const endTrip = async () => {
    if (!token || startingTrip) return;
    setStartingTrip(true);
    setStartError("");
    try {
      await operationsApi.endTrip(token, trip.id);
      await reload();
    } catch (reason) {
      setStartError(
        reason instanceof Error
          ? reason.message
          : "Unable to end this trip.",
      );
    } finally {
      setStartingTrip(false);
    }
  };

  const startVoiceSearch = () => {
    if (isListening) return;
    const speechWindow = window as unknown as CrewSpeechRecognitionWindow;
    const SpeechRecognitionAPI =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      window.alert("Voice search is not supported by this browser. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;
    recognition.lang = "en-LK";
    recognition.continuous = false;
    recognition.interimResults = false;

    const finish = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
    };
    recognition.onend = finish;
    recognition.onerror = () => {
      finish();
      window.alert("Voice search failed. Check microphone permission and try again.");
    };
    recognition.onresult = (event) => {
      const spokenText = event.results[0]?.[0]?.transcript.trim();
      if (spokenText) setSearch(spokenText);
    };

    setIsListening(true);
    try {
      recognition.start();
    } catch {
      finish();
      window.alert("Voice search could not start. Please try again.");
    }
  };

  return (
    <CrewLayout title="Trip Info">
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 sm:px-7 lg:px-10">
        <section className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-10 lg:grid-cols-[280px_minmax(0,320px)] lg:justify-center">
          <div>
            <BoatImage src={boats.find(boat => boat.id === trip.boatId)?.imageUrl} alt={trip.vesselName} className="mb-4 h-40 w-full rounded-xl object-cover"/>
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
              ● {trip.status}
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
                  type="button"
                  disabled={copyState === "copying"}
                  onClick={() => void copy()}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  <Copy size={15} />
                  {copyState === "copying"
                    ? "Copying..."
                    : copyState === "copied"
                      ? "Copied"
                      : copyState === "error"
                        ? "Copy failed"
                        : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={download}
                  className="flex items-center gap-2 rounded-lg bg-[#162d54] px-3 py-2 text-xs font-semibold text-white"
                >
                  <Download size={15} />Download QR
                </button>
              </div>
            )}
          </div>
        </section>

        {trip.status === "Ongoing" && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              disabled={startingTrip}
              onClick={() => void endTrip()}
              className="flex min-h-11 items-center gap-2 rounded-lg bg-[#162d54] px-6 py-3 text-sm font-semibold text-white hover:bg-[#203d6c] disabled:opacity-50"
            >
              <Square size={18} />
              {startingTrip ? "Ending..." : "End Trip"}
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
              type="button"
              disabled={isListening}
              aria-label={isListening ? "Listening for passenger search" : "Start voice search"}
              title={isListening ? "Listening..." : "Start voice search"}
              onClick={startVoiceSearch}
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100 disabled:opacity-50"
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
                        <PassengerCountryDisplay passengerType={passenger.passengerType} countryCode={passenger.countryCode} />
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

        <div className="mt-4">
          <TripTrackingPanel tripId={trip.id} vesselName={trip.vesselName} />
        </div>
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

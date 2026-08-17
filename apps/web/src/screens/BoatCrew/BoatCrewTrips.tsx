import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Mic, Search, Ship } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOperations } from "../../operations/useOperations";
import { CrewLayout, State } from "./components/CrewLayout";

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

export default function BoatCrewTrips() {
  const navigate = useNavigate();
  const { trips, boats, loading, error } = useOperations();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
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

  const rows = useMemo(
    () => trips
      .filter((trip) =>
        `${trip.vesselName} ${trip.registrationNumber} ${trip.status} ${trip.shoreApproval}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )
      .sort((first, second) =>
        sort === "time"
          ? +new Date(first.scheduledDepartureUtc) - +new Date(second.scheduledDepartureUtc)
          : sort === "status"
            ? first.status.localeCompare(second.status)
            : first.vesselName.localeCompare(second.vesselName),
      ),
    [trips, search, sort],
  );

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
    <CrewLayout title="My Trips">
      <div className="mx-auto w-full max-w-[1300px] px-4 pb-12 sm:px-7 sm:pb-14 lg:px-12">
        <h1 className="mb-4 text-[20px] font-semibold sm:mb-6 sm:text-[26px] lg:text-[30px]">
          My Trips
        </h1>
        <section
          aria-label="Trip filters"
          className="mb-6 flex w-full items-center gap-3 sm:mb-8 sm:gap-5"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 text-[#555] sm:left-3 sm:h-5 sm:w-5"
              strokeWidth={1.5}
            />
            <input
              type="search"
              value={search}
              placeholder="Search"
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-10 w-full rounded-lg bg-transparent py-2 pl-7 pr-2 text-[11px] text-[#333] outline-none placeholder:text-[#888] focus:bg-gray-50 sm:pl-10 sm:text-[13px]"
            />
          </div>
          <button
            type="button"
            disabled={isListening}
            aria-label={isListening ? "Listening for trip search" : "Start voice search"}
            title={isListening ? "Listening..." : "Start voice search"}
            onClick={startVoiceSearch}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#555] transition hover:bg-gray-100 disabled:opacity-50"
          >
            <Mic className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.5} />
          </button>
          <div className="relative shrink-0">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="min-h-10 appearance-none rounded-[10px] border-0 bg-[#f8f9fb] py-2 pl-3 pr-8 text-[9px] text-[#888] outline-none focus:ring-2 focus:ring-[#162d54] sm:min-w-[145px] sm:pl-4 sm:text-[11px]"
            >
              <option value="name">Sort by: Name</option>
              <option value="time">Sort by: Time</option>
              <option value="status">Sort by: Status</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#555]"
              strokeWidth={1.5}
            />
          </div>
        </section>

        {loading ? (
          <State>Loading trips…</State>
        ) : error ? (
          <State tone="error">{error}</State>
        ) : rows.length === 0 ? (
          <State>No trips match your search.</State>
        ) : (
          <section
            aria-label="My trips"
            className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
          >
            {rows.map((trip) => {
              const boat = boats.find((item) => item.id === trip.boatId);
              return (
                <article
                  key={trip.id}
                  className="w-full overflow-hidden rounded-[22px] bg-white p-3 shadow-[0_6px_9px_rgba(0,0,0,0.22)] sm:p-4"
                >
                  <div className="grid grid-cols-[minmax(0,0.75fr)_minmax(145px,1.25fr)] items-center gap-3 sm:grid-cols-[minmax(130px,0.75fr)_minmax(210px,1.25fr)] sm:gap-5 md:grid-cols-[minmax(120px,0.75fr)_minmax(180px,1.25fr)] xl:grid-cols-[minmax(125px,0.75fr)_minmax(190px,1.25fr)]">
                    <div className="min-w-0">
                      <p className="text-[16px] font-semibold sm:text-[18px]">Boat</p>
                      <p className="mt-1 truncate text-[16px] sm:text-[18px]">
                        {trip.vesselName}
                      </p>
                      <p className="mt-3 text-[16px] font-semibold sm:text-[18px]">Time</p>
                      <p className="mt-1 text-[12px] sm:text-[14px]">
                        {new Intl.DateTimeFormat("en-LK", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(trip.scheduledDepartureUtc))}
                      </p>
                      <div className="mt-3 flex items-center gap-1">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            trip.shoreApproval === "Approved"
                              ? "bg-[#20e620]"
                              : "bg-amber-400"
                          }`}
                        />
                        <span
                          className={`text-[8px] font-medium uppercase sm:text-[9px] ${
                            trip.shoreApproval === "Approved"
                              ? "text-[#20d820]"
                              : "text-amber-500"
                          }`}
                        >
                          {trip.shoreApproval}
                        </span>
                      </div>
                    </div>
                    {boat?.imageUrl ? (
                      <img
                        src={boat.imageUrl}
                        alt={`${trip.vesselName} boat`}
                        className="h-[145px] w-full rounded-[12px] object-cover object-center sm:h-[180px] md:h-[170px] xl:h-[180px]"
                      />
                    ) : (
                      <div className="flex h-[145px] w-full items-center justify-center rounded-[12px] bg-slate-100 sm:h-[180px]">
                        <Ship className="text-slate-300" size={40} />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/crew/trip-info/${trip.id}`)}
                    className="mt-3 flex min-h-9 w-full items-center justify-center gap-1 rounded-[9px] bg-[#162d54] px-4 py-2 text-[12px] text-white transition hover:bg-[#203d6c] sm:min-h-10 sm:text-[13px]"
                  >
                    Info ⓘ
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </CrewLayout>
  );
}

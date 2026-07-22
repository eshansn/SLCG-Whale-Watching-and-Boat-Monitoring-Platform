import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/ui/icon";
import Navbar from "./components/Navbar";
import { useAuth } from "../../auth/useAuth";
import { connectOperations, operationsApi } from "../../operations/operationsApi";

type SortOption =
  | "vessel-asc"
  | "vessel-desc"
  | "registration-asc"
  | "registration-desc"
  | "passengers-asc"
  | "passengers-desc";

interface EmergencyAlert {
  id: string;
  vesselName: string;
  registrationNumber: string;
  location: string;
  passengersOnboard: number;
  natureOfEmergency: string;
  raisedAtUtc: string;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  0: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
}
interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const ITEMS_PER_PAGE = 4;

export default function OPSSOS() {
  const {session}=useAuth();
  const [alerts,setAlerts] = useState<EmergencyAlert[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("vessel-asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isListening, setIsListening] = useState(false);

  useEffect(()=>{
    if(!session)return;
    let active=true;
    const load=()=>void operationsApi.sosAlerts(session.accessToken).then(items=>{if(active)setAlerts(items)}).catch(()=>undefined);
    load(); const interval=window.setInterval(load,5000); const disconnect=connectOperations(session.accessToken,load);
    return()=>{active=false;window.clearInterval(interval);disconnect()};
  },[session]);

  const filteredAndSortedAlerts = useMemo(() => {
    const searchTerm = searchValue.trim().toLowerCase();

    const filteredAlerts = alerts.filter((alert) => {
      return (
        alert.vesselName.toLowerCase().includes(searchTerm) ||
        alert.registrationNumber.toLowerCase().includes(searchTerm) ||
        alert.location.toLowerCase().includes(searchTerm) ||
        alert.natureOfEmergency.toLowerCase().includes(searchTerm) ||
        alert.passengersOnboard.toString().includes(searchTerm)
      );
    });

    return [...filteredAlerts].sort((firstAlert, secondAlert) => {
      switch (sortOption) {
        case "vessel-desc":
          return secondAlert.vesselName.localeCompare(firstAlert.vesselName);
        case "registration-asc":
          return firstAlert.registrationNumber.localeCompare(secondAlert.registrationNumber);
        case "registration-desc":
          return secondAlert.registrationNumber.localeCompare(firstAlert.registrationNumber);
        case "passengers-asc":
          return firstAlert.passengersOnboard - secondAlert.passengersOnboard;
        case "passengers-desc":
          return secondAlert.passengersOnboard - firstAlert.passengersOnboard;
        case "vessel-asc":
        default:
          return firstAlert.vesselName.localeCompare(secondAlert.vesselName);
      }
    });
  }, [alerts, searchValue, sortOption]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedAlerts.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const visibleAlerts = filteredAndSortedAlerts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setSearchValue(event.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setSortOption(event.target.value as SortOption);
    setCurrentPage(1);
  };

  const handleVoiceSearch = (): void => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      window.alert("Voice search is not supported by this browser. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      window.alert("Voice recognition was unsuccessful. Please try again.");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const spokenText = event.results[0][0].transcript;
      setSearchValue(spokenText);
      setCurrentPage(1);
    };

    recognition.start();
  };

  const getPaginationItems = (): Array<number | "..."> => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, "...", totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-[Poppins] text-[#14223d]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-4 lg:px-10 lg:py-6">
        <section className="rounded-md bg-white px-6 py-6 shadow-[0_8px_30px_rgba(15,23,42,0.05)] md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h1 className="text-xl font-semibold">Emergency alerts</h1>

            <div className="flex w-full flex-col gap-4 sm:flex-row lg:w-auto">
              <div className="relative w-full sm:w-[320px]">
                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                  <Icon name="search" size={16} />
                </div>

                <input
                  type="search"
                  value={searchValue}
                  onChange={handleSearchChange}
                  placeholder="Search"
                  className="h-11 w-full rounded-md border border-slate-100 bg-[#F9FBFF] pl-10 pr-12 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />

                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  aria-label="Search using microphone"
                  className={`absolute inset-y-0 right-3 flex items-center ${
                    isListening ? "text-[#FF0000]" : "text-slate-500 hover:text-indigo-700"
                  }`}
                >
                  <Icon name="mic" size={17} />
                </button>
              </div>

              <div className="flex h-11 min-w-[230px] items-center rounded-md bg-[#F9FBFF] px-4">
                <span className="whitespace-nowrap text-xs text-slate-500">Sort by:</span>
                <select
                  value={sortOption}
                  onChange={handleSortChange}
                  className="w-full cursor-pointer border-none bg-[#F9FBFF] pl-2 pr-6 text-xs font-bold text-[#14223d] outline-none"
                >
                  <option value="vessel-asc">Name</option>
                  <option value="vessel-desc">Name: Z–A</option>
                  <option value="registration-asc">Registration: Ascending</option>
                  <option value="registration-desc">Registration: Descending</option>
                  <option value="passengers-asc">Passengers: Low to High</option>
                  <option value="passengers-desc">Passengers: High to Low</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] text-slate-500">
                  <th className="px-3 py-3 text-center font-medium">Vessel</th>
                  <th className="px-3 py-3 text-center font-medium">Registration no</th>
                  <th className="px-3 py-3 text-center font-medium">Location</th>
                  <th className="px-3 py-3 text-center font-medium">Passengers onboard</th>
                  <th className="px-3 py-3 text-center font-medium">Nature of emergency</th>
                  <th className="px-3 py-3 text-center"></th>
                </tr>
              </thead>

              <tbody>
                {visibleAlerts.map((alert) => (
                  <tr key={alert.id} className="border-b border-slate-100 text-xs hover:bg-[#F9FBFF]">
                    <td className="px-3 py-4 text-center font-medium">{alert.vesselName}</td>
                    <td className="px-3 py-4 text-center font-medium">{alert.registrationNumber}</td>
                    <td className="px-3 py-4 text-center text-slate-600">{alert.location}</td>
                    <td className="px-3 py-4 text-center text-slate-600">{alert.passengersOnboard}</td>
                    <td className="px-3 py-4 text-center font-semibold text-[#FF0000]">{alert.natureOfEmergency}</td>
                    <td className="px-3 py-4">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full bg-[#FF0000] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e60000]"
                        >
                          <span>SOS</span>
                          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                            <path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="m13 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visibleAlerts.length === 0 && (
            <div className="py-16 text-center">
              <Icon name="search" size={30} className="mx-auto" />
              <h2 className="mt-4 text-sm font-semibold">No alerts found</h2>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-5 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-[#F4F5F7] disabled:opacity-40"
              >
                ‹
              </button>

              {getPaginationItems().map((item, index) =>
                item === "..." ? (
                  <span key={`ellipsis-${index}`} className="flex h-9 items-center justify-center px-1">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item as number)}
                    className={`flex h-9 w-9 items-center justify-center rounded-md text-sm ${
                      currentPage === item
                        ? "bg-[#14223d] font-semibold text-white"
                        : "bg-[#F4F5F7] text-slate-600"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-[#F4F5F7] disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

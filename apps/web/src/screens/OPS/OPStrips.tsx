import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/ui/icon";
import Navbar from "./components/Navbar";
import { useOperations } from "../../operations/useOperations";
import type { Trip as OperationTrip } from "../../operations/operationsApi";
type ApprovalStatus = "Approved" | "Pending" | "Not Approved";

type SortOption =
  | "vessel-asc"
  | "vessel-desc"
  | "registration-asc"
  | "registration-desc"
  | "approval-approved"
  | "approval-pending"
  | "approval-not-approved";

interface Trip {
  id: string;
  vesselName: string;
  registrationNumber: string;
  location: string;
  departureTime: string;
  approval: ApprovalStatus;
}

// Interfaces for Voice Search
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

const approvalPriority: Record<ApprovalStatus, number> = {
  Approved: 1,
  Pending: 2,
  "Not Approved": 3,
};

const OPStrips = () => {
  const navigate = useNavigate();
  const { trips: operationTrips, boats, loading, error } = useOperations();
  const trips = useMemo<Trip[]>(() => operationTrips.map((trip:OperationTrip) => {
    const boat=boats.find(item=>item.id===trip.boatId);
    const boatApproved=boat?.approval==='Approved'||boat?.wildlifeApproval==='Approved';
    const fullyApproved=boatApproved&&trip.shoreApproval==='Approved'&&trip.wildlifeShoreApproval==='Approved';
    const rejected=trip.shoreApproval==='Rejected'||trip.wildlifeShoreApproval==='Rejected';
    return {id:trip.id,vesselName:trip.vesselName,registrationNumber:trip.registrationNumber,
      location:trip.route,departureTime:new Intl.DateTimeFormat('en-LK',{dateStyle:'medium',timeStyle:'short'}).format(new Date(trip.scheduledDepartureUtc)),
      approval:fullyApproved?'Approved':rejected?'Not Approved':'Pending'};
  }),[operationTrips,boats]);
  const [searchValue, setSearchValue] = useState<string>("");
  const [sortOption, setSortOption] = useState<SortOption>("vessel-asc");

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isListening, setIsListening] = useState<boolean>(false);

  const filteredAndSortedTrips = useMemo(() => {
    const searchTerm = searchValue.trim().toLowerCase();

    const filteredTrips = trips.filter((trip) => {
      return (
        trip.vesselName.toLowerCase().includes(searchTerm) ||
        trip.registrationNumber.toLowerCase().includes(searchTerm) ||
        trip.approval.toLowerCase().includes(searchTerm) ||
        trip.location.toLowerCase().includes(searchTerm)
      );
    });

    return [...filteredTrips].sort((firstTrip, secondTrip) => {
      switch (sortOption) {
        case "vessel-desc":
          return secondTrip.vesselName.localeCompare(firstTrip.vesselName);
        case "registration-asc":
          return firstTrip.registrationNumber.localeCompare(secondTrip.registrationNumber);
        case "registration-desc":
          return secondTrip.registrationNumber.localeCompare(firstTrip.registrationNumber);
        case "approval-approved":
          return approvalPriority[firstTrip.approval] - approvalPriority[secondTrip.approval];
        case "approval-pending": {
          const pendingPriority: Record<ApprovalStatus, number> = {
            Pending: 1,
            Approved: 2,
            "Not Approved": 3,
          };
          return pendingPriority[firstTrip.approval] - pendingPriority[secondTrip.approval];
        }
        case "approval-not-approved": {
          const notApprovedPriority: Record<ApprovalStatus, number> = {
            "Not Approved": 1,
            Pending: 2,
            Approved: 3,
          };
          return notApprovedPriority[firstTrip.approval] - notApprovedPriority[secondTrip.approval];
        }
        case "vessel-asc":
        default:
          return firstTrip.vesselName.localeCompare(secondTrip.vesselName);
      }
    });
  }, [trips, searchValue, sortOption]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedTrips.length / ITEMS_PER_PAGE)
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const visibleTrips = filteredAndSortedTrips.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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

  const handleTripInfo = (tripId: string): void => {
    navigate(`/ops/trip-info/${tripId}`);
  };

  const getApprovalColour = (approval: ApprovalStatus): string => {
    switch (approval) {
      case "Approved":
        return "text-[#10B981]"; // Green
      case "Not Approved":
        return "text-[#FF0000]"; // Red
      case "Pending":
        return "text-slate-600"; // Slate/Dark
      default:
        return "text-slate-500";
    }
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
          
          {/* Header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h1 className="text-xl font-semibold">Ongoing Trips</h1>

            <div className="flex w-full flex-col gap-4 sm:flex-row lg:w-auto">
              
              {/* Search */}
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

              {/* Sort Dropdown */}
              <div className="flex h-11 min-w-[230px] items-center rounded-md bg-[#F9FBFF] px-4">
                <span className="whitespace-nowrap text-xs text-slate-500">
                  Sort by:
                </span>

                <select
                  value={sortOption}
                  onChange={handleSortChange}
                  className="w-full cursor-pointer border-none bg-[#F9FBFF] pl-2 pr-6 text-xs font-bold text-[#14223d] outline-none"
                >
                  <option value="vessel-asc">Name</option>
                  <option value="vessel-desc">Name: Z–A</option>
                  <option value="registration-asc">Registration: Ascending</option>
                  <option value="registration-desc">Registration: Descending</option>
                  <option value="approval-approved">Approval: Approved first</option>
                  <option value="approval-pending">Approval: Pending first</option>
                  <option value="approval-not-approved">Approval: Not Approved first</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] text-slate-500">
                  <th className="px-3 py-3 text-center font-medium">Vessel</th>
                  <th className="px-3 py-3 text-center font-medium">Registration no</th>
                  <th className="px-3 py-3 text-center font-medium">Location</th>
                  <th className="px-3 py-3 text-center font-medium">Departure Time</th>
                  <th className="px-3 py-3 text-center font-medium">Approval</th>
                  <th className="px-3 py-3 text-center"></th> {/* Actions */}
                </tr>
              </thead>

              <tbody>
                {visibleTrips.map((trip) => (
                  <tr
                    key={trip.id}
                    className="border-b border-slate-100 text-xs hover:bg-[#F9FBFF]"
                  >
                    <td className="px-3 py-4 text-center font-medium">
                      {trip.vesselName}
                    </td>

                    <td className="px-3 py-4 text-center font-medium">
                      {trip.registrationNumber}
                    </td>

                    <td className="px-3 py-4 text-center text-slate-600">
                      {trip.location}
                    </td>

                    <td className="px-3 py-4 text-center text-slate-600">
                      {trip.departureTime}
                    </td>

                    <td
                      className={`px-3 py-4 text-center font-medium ${getApprovalColour(trip.approval)}`}
                    >
                      {trip.approval}
                    </td>

                    <td className="px-3 py-4">
                      <div className="flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onClick={() => handleTripInfo(trip.id)}
                          className="flex h-9 w-9 items-center justify-center text-[#14223d] transition-transform hover:scale-110"
                        >
                          <Icon
                            name="info"
                            size={20}
                            className="[&_*]:stroke-[#14223d] [&_*]:stroke-[2.0]"
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visibleTrips.length === 0 && (
            <div className="py-16 text-center">
              <Icon name="search" size={30} className="mx-auto" />
              <h2 className="mt-4 text-sm font-semibold">
                {loading ? "Loading trips…" : error || "No trips found"}
              </h2>
            </div>
          )}

          {/* Bottom Area (Pagination Only) */}
          <div className="mt-8 flex flex-col gap-5 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-end">
            
            {/* Pagination */}
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
                  <span
                    key={`ellipsis-${index}`}
                    className="flex h-9 items-center justify-center px-1"
                  >
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
};

export default OPStrips;

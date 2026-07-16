import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ChangeEvent } from "react";
import {
  NavLink,
  useNavigate,
} from "react-router-dom";
import { Icon } from "../../components/ui/icon";

type ApprovalStatus =
  | "Approved"
  | "Not Approved"
  | "Pending";

type SortOption =
  | "time-asc"
  | "time-desc"
  | "vessel-asc"
  | "vessel-desc"
  | "owner-asc"
  | "owner-desc"
  | "approved-first"
  | "pending-first"
  | "not-approved-first";

interface ScheduledTrip {
  id: number;
  vesselName: string;
  owner: string;
  registrationNumber: string;
  scheduledDateTime: string;
  approval: ApprovalStatus;
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

const initialTrips: ScheduledTrip[] = [
  {
    id: 1,
    vesselName: "FV Mirissa King",
    owner: "Nimal Perera",
    registrationNumber: "SL-WWB-2047",
    scheduledDateTime: "2026-07-14T06:30:00",
    approval: "Approved",
  },
  {
    id: 2,
    vesselName: "Blue Horizon",
    owner: "Kasun Silva",
    registrationNumber: "SL-WWB-2048",
    scheduledDateTime: "2026-07-14T08:30:00",
    approval: "Approved",
  },
  {
    id: 3,
    vesselName: "Sea Pearl",
    owner: "Amal Fernando",
    registrationNumber: "SL-WWB-2049",
    scheduledDateTime: "2026-07-14T09:30:00",
    approval: "Not Approved",
  },
  {
    id: 4,
    vesselName: "Marine Star",
    owner: "Dilan Kumara",
    registrationNumber: "SL-WWB-2050",
    scheduledDateTime: "2026-07-14T10:30:00",
    approval: "Pending",
  },
  {
    id: 5,
    vesselName: "Ocean Explorer",
    owner: "Ruwan Jayasinghe",
    registrationNumber: "SL-WWB-2051",
    scheduledDateTime: "2026-07-14T11:30:00",
    approval: "Approved",
  },
  {
    id: 6,
    vesselName: "Whale Seeker",
    owner: "Chaminda Silva",
    registrationNumber: "SL-WWB-2052",
    scheduledDateTime: "2026-07-15T06:00:00",
    approval: "Pending",
  },
  {
    id: 7,
    vesselName: "Southern Wave",
    owner: "Tharindu Fernando",
    registrationNumber: "SL-WWB-2053",
    scheduledDateTime: "2026-07-15T07:30:00",
    approval: "Approved",
  },
  {
    id: 8,
    vesselName: "Ocean Pearl",
    owner: "Kamal Perera",
    registrationNumber: "SL-WWB-2054",
    scheduledDateTime: "2026-07-15T09:00:00",
    approval: "Not Approved",
  },
  {
    id: 9,
    vesselName: "Sea Breeze",
    owner: "Sunil Kumara",
    registrationNumber: "SL-WWB-2055",
    scheduledDateTime: "2026-07-15T10:00:00",
    approval: "Approved",
  },
  {
    id: 10,
    vesselName: "Island Explorer",
    owner: "Nuwan Silva",
    registrationNumber: "SL-WWB-2056",
    scheduledDateTime: "2026-07-15T11:00:00",
    approval: "Pending",
  },
];

const ITEMS_PER_PAGE = 4;

const Trips = () => {
  const navigate = useNavigate();

  const [trips, setTrips] =
    useState<ScheduledTrip[]>(initialTrips);

  const [searchValue, setSearchValue] =
    useState("");

  const [sortOption, setSortOption] =
    useState<SortOption>("time-asc");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [isListening, setIsListening] =
    useState(false);

  const filteredAndSortedTrips = useMemo(() => {
    const searchTerm =
      searchValue.trim().toLowerCase();

    const filteredTrips = trips.filter((trip) => {
      const formattedTime =
        formatScheduledDateTime(
          trip.scheduledDateTime,
        ).toLowerCase();

      return (
        trip.vesselName
          .toLowerCase()
          .includes(searchTerm) ||
        trip.owner
          .toLowerCase()
          .includes(searchTerm) ||
        trip.registrationNumber
          .toLowerCase()
          .includes(searchTerm) ||
        trip.approval
          .toLowerCase()
          .includes(searchTerm) ||
        formattedTime.includes(searchTerm)
      );
    });

    return [...filteredTrips].sort(
      (firstTrip, secondTrip) => {
        switch (sortOption) {
          case "time-desc":
            return (
              new Date(
                secondTrip.scheduledDateTime,
              ).getTime() -
              new Date(
                firstTrip.scheduledDateTime,
              ).getTime()
            );

          case "vessel-asc":
            return firstTrip.vesselName.localeCompare(
              secondTrip.vesselName,
            );

          case "vessel-desc":
            return secondTrip.vesselName.localeCompare(
              firstTrip.vesselName,
            );

          case "owner-asc":
            return firstTrip.owner.localeCompare(
              secondTrip.owner,
            );

          case "owner-desc":
            return secondTrip.owner.localeCompare(
              firstTrip.owner,
            );

          case "approved-first":
            return (
              getApprovalPriority(
                firstTrip.approval,
                "Approved",
              ) -
              getApprovalPriority(
                secondTrip.approval,
                "Approved",
              )
            );

          case "pending-first":
            return (
              getApprovalPriority(
                firstTrip.approval,
                "Pending",
              ) -
              getApprovalPriority(
                secondTrip.approval,
                "Pending",
              )
            );

          case "not-approved-first":
            return (
              getApprovalPriority(
                firstTrip.approval,
                "Not Approved",
              ) -
              getApprovalPriority(
                secondTrip.approval,
                "Not Approved",
              )
            );

          case "time-asc":
          default:
            return (
              new Date(
                firstTrip.scheduledDateTime,
              ).getTime() -
              new Date(
                secondTrip.scheduledDateTime,
              ).getTime()
            );
        }
      },
    );
  }, [trips, searchValue, sortOption]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredAndSortedTrips.length /
        ITEMS_PER_PAGE,
    ),
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex =
    (currentPage - 1) * ITEMS_PER_PAGE;

  const visibleTrips =
    filteredAndSortedTrips.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE,
    );

  const handleSearchChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    setSearchValue(event.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ): void => {
    setSortOption(
      event.target.value as SortOption,
    );
    setCurrentPage(1);
  };

  const handleVoiceSearch = (): void => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      window.alert(
        "Voice search is not supported in this browser. Please use Google Chrome or Microsoft Edge.",
      );
      return;
    }

    const recognition =
      new SpeechRecognitionAPI();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);

      window.alert(
        "Voice recognition was unsuccessful. Please try again.",
      );
    };

    recognition.onresult = (
      event: SpeechRecognitionEvent,
    ) => {
      const spokenText =
        event.results[0][0].transcript;

      setSearchValue(spokenText);
      setCurrentPage(1);
    };

    recognition.start();
  };

  const handleTripInfo = (
    tripId: number,
  ): void => {
    navigate(`/admin/trip-info/${tripId}`);
  };

  const handleDeleteTrip = (
    tripId: number,
  ): void => {
    const selectedTrip = trips.find(
      (trip) => trip.id === tripId,
    );

    if (!selectedTrip) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete the scheduled trip for "${selectedTrip.vesselName}"?`,
    );

    if (!confirmed) {
      return;
    }

    setTrips((previousTrips) =>
      previousTrips.filter(
        (trip) => trip.id !== tripId,
      ),
    );
  };

  const getPaginationItems =
    (): Array<number | "..."> => {
      if (totalPages <= 5) {
        return Array.from(
          { length: totalPages },
          (_, index) => index + 1,
        );
      }

      if (currentPage <= 3) {
        return [
          1,
          2,
          3,
          4,
          "...",
          totalPages,
        ];
      }

      if (currentPage >= totalPages - 2) {
        return [
          1,
          "...",
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        ];
      }

      return [
        1,
        "...",
        currentPage - 1,
        currentPage,
        currentPage + 1,
        "...",
        totalPages,
      ];
    };

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-[Poppins] text-[#14223D]">
      {/* Navigation Bar */}
      <nav className="hidden" aria-hidden="true">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            aria-label="Go to admin dashboard"
          >
            <img
              src="/SLCG.png"
              alt="Sri Lanka Coast Guard Logo"
              className="h-10 w-auto object-contain"
            />
          </button>

          <div className="flex items-center gap-8 text-sm text-[#14223D]">
            <button
              type="button"
              aria-label="Notifications"
              className="transition-colors hover:text-indigo-700"
            >
              <Icon
                name="notification"
                size={21}
              />
            </button>

            <NavLink
              to="/admin/manage-users"
              className={({ isActive }) =>
                isActive
                  ? "font-bold text-indigo-800"
                  : "font-normal hover:text-indigo-700"
              }
            >
              Users
            </NavLink>

            <NavLink
              to="/admin/manage-fleets"
              className={({ isActive }) =>
                isActive
                  ? "font-bold text-indigo-800"
                  : "font-normal hover:text-indigo-700"
              }
            >
              Boats
            </NavLink>

            <NavLink
              to="/admin/trips"
              className={({ isActive }) =>
                isActive
                  ? "font-bold text-indigo-800"
                  : "font-normal hover:text-indigo-700"
              }
            >
              Trips
            </NavLink>

            <NavLink
              to="/admin/inquiries"
              className={({ isActive }) =>
                isActive
                  ? "font-bold text-indigo-800"
                  : "font-normal hover:text-indigo-700"
              }
            >
              Inquiries
            </NavLink>

            <NavLink
              to="/admin/settings"
              className={({ isActive }) =>
                isActive
                  ? "font-bold text-indigo-800"
                  : "font-normal hover:text-indigo-700"
              }
            >
              Settings
            </NavLink>

            <button
              type="button"
              onClick={() =>
                navigate("/login")
              }
              className="rounded-md bg-[#14223D] px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-[#22375F]"
            >
              Log Out
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <section className="rounded-lg bg-white px-8 py-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          {/* Header */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <h1 className="text-xl font-semibold">
              Scheduled Trips
            </h1>

            <div className="flex w-full flex-col gap-4 sm:flex-row lg:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-[320px]">
                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                  <Icon
                    name="search"
                    size={17}
                  />
                </div>

                <input
                  type="search"
                  value={searchValue}
                  onChange={handleSearchChange}
                  placeholder="Search"
                  aria-label="Search scheduled trips"
                  className="h-11 w-full rounded-md border border-slate-100 bg-[#F9FBFF] pl-10 pr-12 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />

                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  aria-label="Search using microphone"
                  title={
                    isListening
                      ? "Listening..."
                      : "Search using microphone"
                  }
                  className={`absolute inset-y-0 right-3 flex items-center transition-colors ${
                    isListening
                      ? "text-[#FF0000]"
                      : "text-slate-500 hover:text-indigo-700"
                  }`}
                >
                  <Icon
                    name="mic"
                    size={18}
                  />
                </button>
              </div>

              {/* Sort Dropdown */}
              <div className="flex h-11 min-w-[205px] items-center rounded-md bg-[#F9FBFF] px-4">
                <span className="whitespace-nowrap text-xs text-slate-500">
                  Sort by:
                </span>

                <select
                  value={sortOption}
                  onChange={handleSortChange}
                  aria-label="Sort scheduled trips"
                  className="w-full cursor-pointer border-none bg-[#F9FBFF] pl-2 pr-6 text-xs font-semibold text-[#14223D] outline-none"
                >
                  <option value="time-asc">
                    Time: Earliest
                  </option>

                  <option value="time-desc">
                    Time: Latest
                  </option>

                  <option value="vessel-asc">
                    Vessel A-Z
                  </option>

                  <option value="vessel-desc">
                    Vessel Z-A
                  </option>

                  <option value="owner-asc">
                    Owner A-Z
                  </option>

                  <option value="owner-desc">
                    Owner Z-A
                  </option>

                  <option value="approved-first">
                    Approved first
                  </option>

                  <option value="pending-first">
                    Pending first
                  </option>

                  <option value="not-approved-first">
                    Not Approved first
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="mt-8 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-500">
                  <th className="px-4 py-4">
                    Vessel
                  </th>

                  <th className="px-4 py-4">
                    Owner
                  </th>

                  <th className="px-4 py-4">
                    Registration No.
                  </th>

                  <th className="px-4 py-4">
                    Scheduled Time
                  </th>

                  <th className="px-4 py-4">
                    Approval
                  </th>

                  <th className="px-4 py-4 text-center">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibleTrips.map((trip) => (
                  <tr
                    key={trip.id}
                    className="border-b border-slate-100 text-xs transition-colors hover:bg-[#F9FBFF]"
                  >
                    <td className="px-4 py-5 font-medium">
                      {trip.vesselName}
                    </td>

                    <td className="px-4 py-5 text-slate-600">
                      {trip.owner}
                    </td>

                    <td className="px-4 py-5 text-slate-600">
                      {
                        trip.registrationNumber
                      }
                    </td>

                    <td className="px-4 py-5 text-slate-600">
                      {formatScheduledDateTime(
                        trip.scheduledDateTime,
                      )}
                    </td>

                    <td
                      className={`px-4 py-5 font-medium ${getApprovalClassName(
                        trip.approval,
                      )}`}
                    >
                      {trip.approval}
                    </td>

                    <td className="px-4 py-5">
                      <div className="flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onClick={() =>
                            handleTripInfo(
                              trip.id,
                            )
                          }
                          aria-label={`View ${trip.vesselName} trip information`}
                          title="View trip information"
                          className="flex h-9 w-9 items-center justify-center text-[#14223D] transition-transform hover:scale-110"
                        >
                          <Icon
                            name="info"
                            size={24}
                            className="[&_*]:stroke-[#14223D] [&_*]:stroke-[2.7]"
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteTrip(
                              trip.id,
                            )
                          }
                          aria-label={`Delete ${trip.vesselName} trip`}
                          title="Delete trip"
                          className="flex h-9 w-9 items-center justify-center text-[#FF0000] transition-transform hover:scale-110"
                        >
                          <Icon
                            name="delete"
                            size={19}
                            className="text-[#FF0000] [&_*]:stroke-[#FF0000] [&_*]:fill-[#FF0000]"
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="mt-8 grid gap-4 md:hidden">
            {visibleTrips.map((trip) => (
              <article
                key={trip.id}
                className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm"
              >
                <h2 className="text-sm font-semibold">
                  {trip.vesselName}
                </h2>

                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <p>
                    <span className="font-medium">
                      Owner:{" "}
                    </span>
                    {trip.owner}
                  </p>

                  <p>
                    <span className="font-medium">
                      Registration:{" "}
                    </span>
                    {
                      trip.registrationNumber
                    }
                  </p>

                  <p>
                    <span className="font-medium">
                      Scheduled:{" "}
                    </span>
                    {formatScheduledDateTime(
                      trip.scheduledDateTime,
                    )}
                  </p>

                  <p>
                    <span className="font-medium">
                      Approval:{" "}
                    </span>

                    <span
                      className={getApprovalClassName(
                        trip.approval,
                      )}
                    >
                      {trip.approval}
                    </span>
                  </p>
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      handleTripInfo(trip.id)
                    }
                    className="flex items-center gap-2 rounded-md border border-indigo-200 px-4 py-2 text-xs font-medium text-indigo-700"
                  >
                    <Icon
                      name="info"
                      size={17}
                    />
                    View
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteTrip(
                        trip.id,
                      )
                    }
                    className="flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-xs font-medium text-[#FF0000]"
                  >
                    <Icon
                      name="delete"
                      size={16}
                      className="[&_*]:stroke-[#FF0000] [&_*]:fill-[#FF0000]"
                    />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Empty State */}
          {visibleTrips.length === 0 && (
            <div className="py-16 text-center">
              <Icon
                name="search"
                size={30}
                className="mx-auto"
              />

              <h2 className="mt-4 text-sm font-semibold">
                No scheduled trips found
              </h2>

              <p className="mt-2 text-xs text-slate-500">
                Try searching by vessel,
                owner, registration number,
                scheduled time, or approval
                status.
              </p>
            </div>
          )}

          {/* Pagination */}
          <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={
                  currentPage === 1
                }
                onClick={() =>
                  setCurrentPage(
                    (previousPage) =>
                      Math.max(
                        previousPage - 1,
                        1,
                      ),
                  )
                }
                aria-label="Previous page"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F4F5F7] text-sm text-slate-500 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>

              {getPaginationItems().map(
                (item, index) =>
                  item === "..." ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="flex h-8 min-w-6 items-center justify-center text-xs font-semibold"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() =>
                        setCurrentPage(
                          item,
                        )
                      }
                      aria-label={`Go to page ${item}`}
                      aria-current={
                        currentPage === item
                          ? "page"
                          : undefined
                      }
                      className={`flex h-8 w-8 items-center justify-center rounded-md text-xs transition-colors ${
                        currentPage ===
                        item
                          ? "bg-[#14223D] font-semibold text-white"
                          : "bg-[#F4F5F7] text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {item}
                    </button>
                  ),
              )}

              <button
                type="button"
                disabled={
                  currentPage ===
                  totalPages
                }
                onClick={() =>
                  setCurrentPage(
                    (previousPage) =>
                      Math.min(
                        previousPage + 1,
                        totalPages,
                      ),
                  )
                }
                aria-label="Next page"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F4F5F7] text-sm text-slate-500 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
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

const getApprovalPriority = (
  currentStatus: ApprovalStatus,
  preferredStatus: ApprovalStatus,
): number => {
  return currentStatus === preferredStatus
    ? 0
    : 1;
};

const getApprovalClassName = (
  approval: ApprovalStatus,
): string => {
  switch (approval) {
    case "Approved":
      return "text-green-500";

    case "Not Approved":
      return "text-[#FF0000]";

    case "Pending":
      return "text-slate-700";

    default:
      return "text-slate-500";
  }
};

const formatScheduledDateTime = (
  dateTime: string,
): string => {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    },
  ).format(new Date(dateTime));
};

export default Trips;

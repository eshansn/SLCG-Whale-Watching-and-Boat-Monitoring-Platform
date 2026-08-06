import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ChevronDown,
  CalendarPlus,
  Menu as MenuIcon,
  Mic,
  Search,
  Settings,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import groupIcon from "../../assets/icons/group.svg";
import infoIcon from "../../assets/icons/info.svg";
import notificationIcon from "../../assets/icons/notification.svg";
import userIcon from "../../assets/icons/user.svg";
import vesselIcon from "../../assets/icons/vessel.svg";
import dashboardIcon from "../../assets/icons/dashboard.svg";
import crewIcon from "../../assets/icons/crew.svg";
import tripsIcon from "../../assets/icons/trips.svg";
import { useOperations } from "../../operations/useOperations";

interface Trip {
  id: string;
  boatName: string;
  registrationNumber: string;
  time: string;
  status: "approved" | "pending";
  image: string;
}

interface MenuItem {
  label: string;
  path: string;
  icon?: string;
  type?: "settings";
}

const menuItems: MenuItem[] = [
  {
    label: "Dashboard",
    path: "/owner",
    icon: dashboardIcon,
  },
  {
    label: "Profile",
    path: "/owner/profile",
    icon: userIcon,
  },
  {
    label: "My Crew",
    path: "/owner/crew",
    icon: crewIcon,
  },
  {
    label: "My Boats",
    path: "/owner/boats",
    icon: vesselIcon,
  },
  {
    label: "My Trips",
    path: "/owner/trips",
    icon: tripsIcon,
  },
  {
    label: "Settings",
    path: "/owner/settings",
    type: "settings",
  },
];

function BoatOwnerTripsPage() {
  const navigate = useNavigate();
  const { trips: savedTrips, boats } = useOperations();
  const trips = useMemo<Trip[]>(() => savedTrips.map((trip) => ({
    id: trip.id, boatName: trip.vesselName, registrationNumber: trip.registrationNumber,
    time: new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(trip.scheduledDepartureUtc)),
    status: trip.shoreApproval === 'Approved' ? 'approved' : 'pending',
    image: boats.find((boat) => boat.id === trip.boatId)?.imageUrl || '/OwnerBoat1.png',
  })), [boats, savedTrips]);

  const [isMenuOpen, setIsMenuOpen] =
    useState(false);

  const [searchText, setSearchText] =
    useState("");

  const [sortOption, setSortOption] =
    useState("name");

  const [statusMessage, setStatusMessage] =
    useState("");

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [isMenuOpen]);

  const openPage = (path: string): void => {
    setIsMenuOpen(false);
    navigate(path);
  };

  const displayedTrips = useMemo(() => {
    const normalizedSearch =
      searchText.trim().toLowerCase();

    const filteredTrips = trips.filter((trip) => {
      return (
        trip.boatName
          .toLowerCase()
          .includes(normalizedSearch) ||
        trip.registrationNumber
          .toLowerCase()
          .includes(normalizedSearch) ||
        trip.time
          .toLowerCase()
          .includes(normalizedSearch)
      );
    });

    return [...filteredTrips].sort(
      (firstTrip, secondTrip) => {
        if (sortOption === "time") {
          return firstTrip.time.localeCompare(
            secondTrip.time,
          );
        }

        if (sortOption === "status") {
          return firstTrip.status.localeCompare(
            secondTrip.status,
          );
        }

        return firstTrip.boatName.localeCompare(
          secondTrip.boatName,
        );
      },
    );
  }, [searchText, sortOption, trips]);

  const handleVoiceSearch = (): void => {
    setStatusMessage(
      "Voice search will be connected later.",
    );
  };

  return (
    <main className="boat-owner-page min-h-dvh w-full overflow-x-hidden bg-white text-black">
      {/* Top navigation */}
      <header
        className="
          relative z-30 flex w-full
          items-center justify-between
          bg-white px-5 py-5
          sm:px-8 sm:py-6
          lg:px-12 lg:py-7
          xl:px-16
        "
      >
        <button
          type="button"
          aria-label="Open notifications"
          onClick={() =>
            navigate("/owner/notifications")
          }
          className="
            flex h-10 w-10 items-center
            justify-center rounded-full
            transition-colors hover:bg-gray-100
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#162d54]
          "
        >
          <img
            src={notificationIcon}
            alt=""
            aria-hidden="true"
            className="h-6 w-6 sm:h-7 sm:w-7"
          />
        </button>

        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(true)}
          className="
            flex h-11 w-11 items-center
            justify-center rounded-lg
            transition-colors hover:bg-gray-100
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#162d54]
          "
        >
          <MenuIcon
            className="h-8 w-8 sm:h-9 sm:w-9"
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>
      </header>

      <div
        className="
          mx-auto w-full max-w-[1300px]
          px-4 pb-12
          sm:px-7 sm:pb-14
          lg:px-12
        "
      >
        {/* Schedule trip panel */}
        <section
          className="
            relative flex w-full flex-col overflow-hidden
            items-start rounded-[24px] border border-blue-400/20
            bg-gradient-to-br from-[#101d3b] via-[#162d54] to-[#24558b]
            px-7 py-8 text-left shadow-[0_18px_50px_rgba(22,45,84,.24)]
            sm:px-10 sm:py-10
          "
        >
          <span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-white/12 text-white ring-1 ring-white/20"><CalendarPlus size={25}/></span><h1 className="text-[22px] font-semibold text-white sm:text-[28px]">
            Start New Trips!
          </h1>

          <p
            className="
              mt-2 max-w-[470px]
              text-[13px] font-normal
              leading-6 text-white/75 sm:text-[14px]
            "
          >
            Set up the schedule and preferences
            for an upcoming tour.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate("/owner/trips/schedule")
            }
            className="
              mt-7 inline-flex min-h-12 w-full
              max-w-[260px] items-center justify-center
              rounded-xl bg-white px-6 py-3
              text-[14px] font-semibold shadow-lg shadow-black/10
              text-[#162d54]
              transition-colors
              hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-xl
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-white
              focus-visible:ring-offset-2
              focus-visible:ring-offset-[#162d54]
              sm:max-w-[320px]
              sm:text-[12px]
            "
          >
            <span className="inline-flex items-center gap-2"><CalendarPlus size={18}/>Schedule Trip</span>
          </button>
        </section>

        <h2
          className="
            mb-4 mt-8 text-[20px]
            font-semibold
            sm:mb-6 sm:mt-10
            sm:text-[26px]
            lg:text-[30px]
          "
        >
          My Trips
        </h2>

        {/* Search and sort controls */}
        <section
          aria-label="Trip filters"
          className="
            mb-6 flex w-full
            items-center gap-3
            sm:mb-8 sm:gap-5
          "
        >
          <div className="relative flex-1">
            <Search
              className="
                pointer-events-none
                absolute left-1 top-1/2
                h-4 w-4 -translate-y-1/2
                text-[#555555]
                sm:left-3 sm:h-5 sm:w-5
              "
              strokeWidth={1.5}
              aria-hidden="true"
            />

            <label
              htmlFor="tripSearch"
              className="sr-only"
            >
              Search trips
            </label>

            <input
              id="tripSearch"
              type="search"
              value={searchText}
              placeholder="Search"
              onChange={(event) => {
                setSearchText(event.target.value);
                setStatusMessage("");
              }}
              className="
                min-h-10 w-full
                rounded-lg border-0
                bg-transparent py-2
                pl-7 pr-2
                text-[11px] font-normal
                text-[#333333]
                outline-none
                placeholder:text-[#888888]
                focus:bg-gray-50
                sm:pl-10 sm:text-[13px]
              "
            />
          </div>

          <button
            type="button"
            aria-label="Start voice search"
            onClick={handleVoiceSearch}
            className="
              flex h-10 w-10 shrink-0
              items-center justify-center
              rounded-full text-[#555555]
              transition-colors
              hover:bg-gray-100
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#162d54]
            "
          >
            <Mic
              className="h-4 w-4 sm:h-5 sm:w-5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </button>

          <div className="relative shrink-0">
            <label
              htmlFor="tripSort"
              className="sr-only"
            >
              Sort trips
            </label>

            <select
              id="tripSort"
              value={sortOption}
              onChange={(event) =>
                setSortOption(event.target.value)
              }
              className="
                min-h-10 appearance-none
                rounded-[10px] border-0
                bg-[#f8f9fb]
                py-2 pl-3 pr-8
                text-[9px] font-normal
                text-[#888888]
                outline-none
                focus:ring-2
                focus:ring-[#162d54]
                sm:min-w-[145px]
                sm:pl-4 sm:text-[11px]
              "
            >
              <option value="name">
                Sort by: Name
              </option>

              <option value="time">
                Sort by: Time
              </option>

              <option value="status">
                Sort by: Status
              </option>
            </select>

            <ChevronDown
              className="
                pointer-events-none
                absolute right-2 top-1/2
                h-4 w-4 -translate-y-1/2
                text-[#555555]
              "
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </div>
        </section>

        {statusMessage && (
          <p
            role="status"
            className="
              mb-4 text-center
              text-[12px] font-medium
              text-[#162d54]
            "
          >
            {statusMessage}
          </p>
        )}

        {/* Trip cards */}
        {displayedTrips.length > 0 ? (
          <section
            aria-label="My trips"
            className="
              grid w-full grid-cols-1 gap-6
              md:grid-cols-2
              xl:grid-cols-3
            "
          >
            {displayedTrips.map((trip) => (
              <article
                key={trip.id}
                className="
                  w-full overflow-hidden
                  rounded-[22px] bg-white p-3
                  shadow-[0_6px_9px_rgba(0,0,0,0.22)]
                  sm:p-4
                "
              >
                <div
                  className="
                    grid
                    grid-cols-[minmax(0,0.75fr)_minmax(145px,1.25fr)]
                    items-center gap-3
                    sm:grid-cols-[minmax(130px,0.75fr)_minmax(210px,1.25fr)]
                    sm:gap-5
                    md:grid-cols-[minmax(120px,0.75fr)_minmax(180px,1.25fr)]
                    xl:grid-cols-[minmax(125px,0.75fr)_minmax(190px,1.25fr)]
                  "
                >
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold sm:text-[18px]">
                      Boat
                    </p>

                    <p className="mt-1 truncate text-[16px] font-normal sm:text-[18px]">
                      {trip.boatName}
                    </p>

                    <p className="mt-3 text-[16px] font-semibold sm:text-[18px]">
                      Time
                    </p>

                    <p className="mt-1 text-[16px] font-normal sm:text-[18px]">
                      {trip.time}
                    </p>

                    <div className="mt-3 flex items-center gap-1">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full bg-[#20e620]"
                      />

                      <span className="text-[8px] font-medium uppercase text-[#20d820] sm:text-[9px]">
                        {trip.status}
                      </span>
                    </div>
                  </div>

                  <img
                    src={trip.image}
                    alt={`${trip.boatName} boat`}
                    className="
                      h-[145px] w-full
                      rounded-[12px] object-cover
                      object-center
                      sm:h-[180px]
                      md:h-[170px]
                      xl:h-[180px]
                    "
                  />
                </div>

                <button
                  type="button"
                  aria-label={`Open ${trip.boatName} trip details`}
                  title="Open trip details"
                  onClick={() =>
                    navigate(
                      `/owner/trips/${trip.id}`,
                    )
                  }
                  className="
                    mt-3 flex min-h-9 w-full
                    items-center justify-center
                    gap-1 rounded-[9px]
                    bg-[#162d54] px-4 py-2
                    text-[12px] font-normal
                    text-white
                    transition-colors
                    hover:bg-[#203d6c]
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-[#162d54]
                    focus-visible:ring-offset-2
                    sm:min-h-10 sm:text-[13px]
                  "
                >
                  <span>Info</span>
                  <img
                    src={infoIcon}
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4 brightness-0 invert"
                  />
                </button>
              </article>
            ))}
          </section>
        ) : (
          <p
            className="
              rounded-xl bg-gray-50
              px-4 py-10 text-center
              text-[14px] text-[#777777]
            "
          >
            No trips match your search.
          </p>
        )}
      </div>

      {/* Side menu */}
      {isMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() =>
              setIsMenuOpen(false)
            }
            className="
              fixed inset-0 z-40
              border-0 bg-black/25
            "
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Boat owner menu"
            className="
              fixed right-0 top-0 z-50
              min-h-dvh w-full
              overflow-y-auto bg-white
              px-8 pb-10 pt-5
              shadow-[-8px_0_24px_rgba(0,0,0,0.16)]
              sm:w-[390px] sm:px-10
              lg:w-[430px] lg:px-12
            "
          >
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() =>
                  setIsMenuOpen(false)
                }
                className="
                  flex h-10 w-10
                  items-center justify-center
                  rounded-full
                  transition-colors
                  hover:bg-gray-100
                  focus:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-[#162d54]
                "
              >
                <X
                  className="h-6 w-6"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>
            </div>

            <nav
              aria-label="Boat owner navigation"
              className="mt-8 flex flex-col gap-2"
            >
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() =>
                    openPage(item.path)
                  }
                  className={`
                    flex w-full items-center gap-6
                    rounded-xl px-3 py-4
                    text-left transition-colors
                    hover:bg-gray-100
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-[#162d54]
                    ${
                      item.path ===
                      "/owner/trips"
                        ? "bg-gray-100 text-[#162d54]"
                        : "text-black"
                    }
                  `}
                >
                  {item.type === "settings" ? (
                    <Settings
                      className="h-8 w-8 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  ) : (
                    <img
                      src={item.icon}
                      alt=""
                      aria-hidden="true"
                      className="
                        h-8 w-8 shrink-0
                        object-contain
                      "
                    />
                  )}

                  <span className="text-[17px] font-semibold">
                    {item.label}
                  </span>
                </button>
              ))}
            </nav>
          </aside>
        </>
      )}
    </main>
  );
}

export default BoatOwnerTripsPage;

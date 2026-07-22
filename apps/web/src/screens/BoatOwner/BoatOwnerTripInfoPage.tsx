import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Bell,
  ArrowRightLeft,
  Copy,
  Download,
  ChevronDown,
  Menu as MenuIcon,
  Mic,
  Search,
  Settings,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Map, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import groupIcon from "../../assets/icons/group.svg";
import infoIcon from "../../assets/icons/info.svg";
import notificationIcon from "../../assets/icons/notification.svg";
import userIcon from "../../assets/icons/user.svg";
import vesselIcon from "../../assets/icons/vessel.svg";
import { useOperations } from "../../operations/useOperations";
import { operationsApi, type TripPassenger, type VesselMapRecord } from "../../operations/operationsApi";
import TripTransferModal from "./TripTransferModal";

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
    icon: infoIcon,
  },
  {
    label: "Profile",
    path: "/owner/profile",
    icon: userIcon,
  },
  {
    label: "My Crew",
    path: "/owner/crew",
    icon: groupIcon,
  },
  {
    label: "My Boats",
    path: "/owner/boats",
    icon: vesselIcon,
  },
  {
    label: "My Trips",
    path: "/owner/trips",
    icon: infoIcon,
  },
  {
    label: "Settings",
    path: "/owner/settings",
    type: "settings",
  },
];

function BoatOwnerTripInfoPage() {
  const navigate = useNavigate();
  const { tripId } =
    useParams<{ tripId: string }>();
  const { trips, loading, error, token } = useOperations();
  const trip = trips.find((item) => item.id === tripId);
  const invitationUrl = trip?.invitationCode ? `${window.location.origin}/passenger/trip/${trip.invitationCode}` : '';

  const [isMenuOpen, setIsMenuOpen] =
    useState(false);

  const [searchText, setSearchText] =
    useState("");

  const [sortOption, setSortOption] =
    useState("name");
  const [liveVessel, setLiveVessel] = useState<VesselMapRecord | null>(null);
  const [mapError, setMapError] = useState("");
  const [passengers, setPassengers] = useState<TripPassenger[]>([]);
  const [passengerError, setPassengerError] = useState("");
  const [transferOpen,setTransferOpen]=useState(false);
  const [transferStatus,setTransferStatus]=useState("");

  useEffect(() => {
    if (!token || !trip?.id) return;
    let active = true;
    const loadPassengers = async (): Promise<void> => {
      try {
        const records = await operationsApi.tripPassengers(token, trip.id);
        if (active) { setPassengers(records); setPassengerError(""); }
      } catch (passengerLoadError) {
        if (active) setPassengerError(passengerLoadError instanceof Error ? passengerLoadError.message : "Unable to load passengers.");
      }
    };
    void loadPassengers();
    const timer = window.setInterval(() => void loadPassengers(), 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token, trip?.id, trip?.updatedAtUtc]);

  useEffect(() => {
    if (!token || !trip?.boatId) return;
    let active = true;
    const loadLocation = async (): Promise<void> => {
      try {
        const vessels = await operationsApi.vesselMap(token);
        if (active) {
          setLiveVessel(vessels.find((vessel) => vessel.id === trip.boatId) ?? null);
          setMapError("");
        }
      } catch (locationError) {
        if (active) setMapError(locationError instanceof Error ? locationError.message : "Unable to load live vessel location.");
      }
    };
    void loadLocation();
    const timer = window.setInterval(() => void loadLocation(), 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token, trip?.boatId]);

  const displayedPassengers = useMemo(() => {
    const normalizedSearch =
      searchText.trim().toLowerCase();

    const filteredPassengers =
      passengers.filter((passenger) => {
        return (
          passenger.name
            .toLowerCase()
            .includes(normalizedSearch) ||
          passenger.identificationNumber
            .toLowerCase()
            .includes(normalizedSearch) ||
          passenger.passengerType
            .toLowerCase()
            .includes(normalizedSearch)
        );
      });

    return [...filteredPassengers].sort(
      (firstPassenger, secondPassenger) => {
        if (sortOption === "age") {
          return firstPassenger.ageCategory.localeCompare(
            secondPassenger.ageCategory,
          );
        }

        if (sortOption === "passengerType") {
          return firstPassenger.passengerType.localeCompare(
            secondPassenger.passengerType,
          );
        }

        return firstPassenger.name.localeCompare(
          secondPassenger.name,
        );
      },
    );
  }, [passengers, searchText, sortOption]);

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

  const copyInvitation = async (): Promise<void> => {
    if (invitationUrl) await navigator.clipboard.writeText(invitationUrl);
  };

  const downloadQr = (): void => {
    const svg = document.getElementById('trip-invitation-qr'); if (!svg || !trip) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `trip-${trip.registrationNumber}-qr.svg`; link.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <main className="grid min-h-dvh place-items-center">Loading trip information...</main>;
  if (error || !trip) return <main className="grid min-h-dvh place-items-center">{error || 'Trip not found.'}</main>;

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
          mx-auto w-full max-w-[1200px]
          px-4 pb-5
          sm:px-7 sm:pb-8
          lg:px-10
        "
      >
        {/* Trip details and QR code */}
        <section
          className="
            grid grid-cols-[130px_minmax(0,1fr)]
            items-center gap-5
            sm:grid-cols-[220px_minmax(0,1fr)]
            sm:gap-10
            lg:grid-cols-[280px_minmax(0,320px)]
            lg:justify-center
          "
        >
          <div>
            <p className="text-[16px] font-semibold sm:text-[20px]">
              Boat
            </p>

            <p className="mt-1 text-[16px] font-normal sm:text-[20px]">
              {trip.vesselName}
            </p>

            <p className="mt-1 text-[16px] font-semibold sm:mt-3 sm:text-[20px]">
              Time
            </p>

            <p className="mt-1 text-[16px] font-normal sm:text-[20px]">
              {new Intl.DateTimeFormat('en-LK', { timeStyle: 'short' }).format(new Date(trip.scheduledDepartureUtc))}
            </p>

            <p className="mt-1 text-[16px] font-semibold sm:mt-3 sm:text-[20px]">
              Date
            </p>

            <p className="mt-1 text-[16px] font-normal sm:text-[20px]">
              {new Intl.DateTimeFormat('en-LK', { dateStyle: 'full' }).format(new Date(trip.scheduledDepartureUtc))}
            </p>

            <div className="mt-2 flex items-center gap-1">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-[#20e620]"
              />

              <span className="text-[8px] font-medium uppercase text-[#20d820] sm:text-[9px]">
                {trip.shoreApproval}
              </span>
            </div>
          </div>

          <div className="justify-self-end text-center">
            {invitationUrl ? <QRCodeSVG id="trip-invitation-qr" value={invitationUrl} size={280} level="H" marginSize={2}
              title={`Passenger invitation for ${trip.vesselName}`} className="aspect-square h-auto w-full max-w-[280px]" /> : <p className="text-sm text-slate-500">QR invitation unavailable for this older trip.</p>}
            {invitationUrl && <div className="mt-3 flex justify-center gap-2">
              <button type="button" onClick={() => void copyInvitation()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-50"><Copy size={15}/>Copy link</button>
              <button type="button" onClick={downloadQr} className="flex items-center gap-2 rounded-lg bg-[#162d54] px-3 py-2 text-xs font-semibold text-white"><Download size={15}/>Download QR</button>
            </div>}
          </div>
        </section>

        {(trip.status==="Scheduled"||trip.status==="Boarding")&&<div className="mt-7 flex flex-col items-center gap-3 border-t border-slate-100 pt-7"><button type="button" onClick={()=>{setTransferStatus("");setTransferOpen(true)}} className="flex min-h-11 items-center gap-2 rounded-lg bg-[#162d54] px-6 py-3 text-sm font-semibold text-white hover:bg-[#203d6c]"><ArrowRightLeft size={18}/>Transfer Passengers / Crew</button>{transferStatus&&<p role="status" className="text-center text-sm font-medium text-emerald-700">{transferStatus}</p>}</div>}

        {/* Passenger information */}
        <section className="mt-7 sm:mt-10">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-[18px] font-semibold sm:text-[24px] lg:text-[27px]">Passenger Info</h1>
            <span className="rounded-full bg-[#162d54] px-3 py-1 text-xs font-semibold text-white">{passengers.length} registered</span>
          </div>

          {/* Search and sorting */}
          <div
            className="
              mt-4 flex w-full
              items-center gap-3
              sm:mt-6 sm:gap-5
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
                htmlFor="passengerSearch"
                className="sr-only"
              >
                Search passengers
              </label>

              <input
                id="passengerSearch"
                type="search"
                value={searchText}
                placeholder="Search"
                onChange={(event) =>
                  setSearchText(event.target.value)
                }
                className="
                  min-h-10 w-full
                  rounded-lg border-0
                  bg-transparent py-2
                  pl-7 pr-2
                  text-[10px] font-normal
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
              className="
                flex h-10 w-10 shrink-0
                items-center justify-center
                rounded-full
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
                htmlFor="passengerSort"
                className="sr-only"
              >
                Sort passengers
              </label>

              <select
                id="passengerSort"
                value={sortOption}
                onChange={(event) =>
                  setSortOption(event.target.value)
                }
                className="
                  min-h-10 appearance-none
                  rounded-[10px] border-0
                  bg-[#f8f9fb]
                  py-2 pl-3 pr-8
                  text-[8px] text-[#777777]
                  outline-none
                  focus:ring-2
                  focus:ring-[#162d54]
                  sm:min-w-[150px]
                  sm:text-[11px]
                "
              >
                <option value="name">
                  Sort by: Name
                </option>

                <option value="age">
                  Sort by: Age
                </option>

                <option value="passengerType">
                  Sort by: Passenger type
                </option>
              </select>

              <ChevronDown
                className="
                  pointer-events-none
                  absolute right-2 top-1/2
                  h-4 w-4 -translate-y-1/2
                "
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Passenger table */}
          <div className="mt-4 w-full overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-b border-[#eeeeee]">
                  <th className="px-2 py-3 text-left text-[9px] font-medium sm:text-[12px]">
                    Name
                  </th>

                  <th className="px-2 py-3 text-left text-[9px] font-medium sm:text-[12px]">
                    NIC or Passport
                  </th>

                  <th className="px-2 py-3 text-left text-[9px] font-medium sm:text-[12px]">
                    Age
                  </th>

                  <th className="px-2 py-3 text-left text-[9px] font-medium sm:text-[12px]">
                    Passenger type
                  </th>
                </tr>
              </thead>

              <tbody>
                {displayedPassengers.map(
                  (passenger) => (
                    <tr
                      key={passenger.id}
                      className="border-b border-[#eeeeee]"
                    >
                      <td className="px-2 py-4 text-[9px] sm:text-[12px]">
                        {passenger.name}
                      </td>

                      <td className="px-2 py-4 text-[9px] sm:text-[12px]">
                        {
                          passenger.identificationNumber
                        }
                      </td>

                      <td className="px-2 py-4 text-[9px] sm:text-[12px]">
                        {passenger.ageCategory}
                      </td>

                      <td className="px-2 py-4 text-[9px] sm:text-[12px]">
                        {passenger.passengerType}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            {passengerError && <p className="py-5 text-sm text-red-600">{passengerError}</p>}
            {!passengerError && displayedPassengers.length === 0 && <p className="py-5 text-sm text-slate-500">No passengers have registered for this trip yet.</p>}
          </div>
        </section>

        {/* Emergency status */}
        <section
          className="
            mt-5 flex min-h-[58px]
            w-full items-center
            justify-center gap-3
            rounded-[3px] bg-[#28ff00]
            px-5 py-3
            sm:min-h-[65px]
          "
        >
          <p className="text-[13px] font-medium sm:text-[15px]">
            No Emergencies
          </p>

          <Bell
            className="h-5 w-5"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </section>

        {/* Live vessel map */}
        <section className="mt-4 overflow-hidden rounded-[12px] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div><h2 className="font-semibold text-[#162d54]">Live vessel location</h2><p className="text-xs text-slate-500">Updates automatically every 10 seconds</p></div>
            {liveVessel?.coordinatesRecordedAtUtc && <span className="text-xs text-slate-500">GPS updated {new Date(liveVessel.coordinatesRecordedAtUtc).toLocaleString()}</span>}
          </div>
          {mapError ? <p className="m-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{mapError}</p> :
          liveVessel?.latitude != null && liveVessel.longitude != null ? (
            <div className="h-[360px] w-full sm:h-[460px]">
              <Map key={`${liveVessel.id}-${liveVessel.latitude}-${liveVessel.longitude}`} initialViewState={{longitude:liveVessel.longitude,latitude:liveVessel.latitude,zoom:14}} mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json">
                <Marker longitude={liveVessel.longitude} latitude={liveVessel.latitude} anchor="center">
                  <div className="flex flex-col items-center">
                    <span className="relative flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-[#162d54] text-white shadow-lg"><span className="absolute h-11 w-11 animate-ping rounded-full bg-[#162d54]/30"/><span className="relative text-xl">▲</span></span>
                    <span className="mt-2 rounded bg-[#162d54] px-3 py-1 text-xs font-semibold text-white shadow">{liveVessel.name}</span>
                  </div>
                </Marker>
              </Map>
            </div>
          ) : <p className="px-5 pb-6 text-sm text-slate-500">No GPS location has been received for this vessel yet.</p>}
        </section>
      </div>

      {/* Side menu */}
      {transferOpen&&token&&<TripTransferModal token={token} sourceTripId={trip.id} onClose={()=>setTransferOpen(false)} onComplete={(result,destination)=>{setTransferOpen(false);setTransferStatus(`Transfer completed successfully. ${result.passengerCount} passengers and ${result.crewCount} crew members were transferred to ${destination.boatName} – Trip ${destination.id}.`)}}/>}

      {isMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() =>
              setIsMenuOpen(false)
            }
            className="fixed inset-0 z-40 border-0 bg-black/25"
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
                      className="h-8 w-8 shrink-0 object-contain"
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

export default BoatOwnerTripInfoPage;

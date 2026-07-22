import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  ChevronDown,
  Menu as MenuIcon,
  Settings,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOperations } from "../../operations/useOperations";
import { operationsApi } from "../../operations/operationsApi";
import type { OwnerCrew } from "../../operations/operationsApi";

import groupIcon from "../../assets/icons/group.svg";
import infoIcon from "../../assets/icons/info.svg";
import notificationIcon from "../../assets/icons/notification.svg";
import userIcon from "../../assets/icons/user.svg";
import vesselIcon from "../../assets/icons/vessel.svg";

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

function BoatOwnerNewTripPage() {
  const navigate = useNavigate();
  const { boats, loading, token } = useOperations();

  const [isMenuOpen, setIsMenuOpen] =
    useState(false);

  const [selectedVessel, setSelectedVessel] =
    useState("");

  const [tripDateTime, setTripDateTime] =
    useState("");

  const [statusMessage, setStatusMessage] =
    useState("");
  const [submitting, setSubmitting] = useState(false);
  const [crew, setCrew] = useState<OwnerCrew[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<string[]>([]);

  useEffect(() => { if (!selectedVessel && boats[0]) setSelectedVessel(boats[0].id); }, [boats, selectedVessel]);
  useEffect(() => { if (token) operationsApi.ownerCrew(token).then(setCrew).catch(() => setStatusMessage('Unable to load your crew.')); }, [token]);

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

  const handleScheduleTrip = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (!selectedVessel) {
      setStatusMessage(
        "Please select a vessel.",
      );
      return;
    }

    if (!tripDateTime) {
      setStatusMessage(
        "Please select the trip date and time.",
      );
      return;
    }
    if (!token) return;
    const scheduled = new Date(tripDateTime);
    if (Number.isNaN(scheduled.getTime()) || scheduled <= new Date()) {
      setStatusMessage("Please select a future date and time."); return;
    }
    try {
      setSubmitting(true); setStatusMessage("Scheduling trip...");
      const created = await operationsApi.createTrip(token, selectedVessel, scheduled.toISOString(), selectedCrew);
      setStatusMessage(created.crewAutoAssigned
        ? `The trip has been scheduled successfully. ${created.crewUserIds.length} available crew members were assigned automatically.`
        : `The trip has been scheduled successfully with ${created.crewUserIds.length} selected crew members.`);
      setTripDateTime("");
      setSelectedCrew([]);
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Unable to schedule trip."); }
    finally { setSubmitting(false); }
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

      {/* New trip form */}
      <form
        onSubmit={handleScheduleTrip}
        className="
          mx-auto flex min-h-[calc(100dvh-84px)]
          w-full max-w-[800px] flex-col
          px-4 pb-4
          sm:min-h-[calc(100dvh-96px)]
          sm:px-8 sm:pb-8
          lg:min-h-[calc(100dvh-104px)]
          lg:px-10 lg:pb-10
        "
      >
        {/* Select vessel */}
        <div className="mt-1">
          <label
            htmlFor="tripVessel"
            className="
              mb-2 block text-[14px]
              font-semibold text-[#252525]
              sm:text-[15px]
            "
          >
            Select A Vessel
          </label>

          <div className="relative">
            <select
              id="tripVessel"
              value={selectedVessel}
              onChange={(event) => {
                setSelectedVessel(
                  event.target.value,
                );
                setStatusMessage("");
              }}
              className="
                min-h-[52px] w-full
                appearance-none rounded-[12px]
                border border-[#e8e2e2]
                bg-white px-4 pr-12
                text-[14px] font-medium
                text-[#252525]
                outline-none
                transition-colors
                focus:border-[#162d54]
                focus:ring-1
                focus:ring-[#162d54]
                sm:min-h-[56px] sm:text-[15px]
              "
            >
              <option value="">{loading ? 'Loading vessels...' : 'Select a vessel'}</option>
              {boats.map((boat) => <option key={boat.id} value={boat.id}>{boat.name} — {boat.registrationNumber}</option>)}
            </select>

            <ChevronDown
              className="
                pointer-events-none
                absolute right-4 top-1/2
                h-5 w-5 -translate-y-1/2
                text-black
              "
              strokeWidth={2}
              aria-hidden="true"
            />
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-[14px] font-semibold text-[#252525] sm:text-[15px]">Assign Crew</legend>
          <p className="mb-2 text-xs text-slate-500">Optional: leave every crew member unchecked to automatically assign all certified crew who are available at the selected date and time.</p>
          <div className="overflow-hidden rounded-xl border border-[#e8e8e8]">
            {crew.length ? crew.map((member) => <label key={member.crewUserId} className="grid min-h-[50px] cursor-pointer grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_40px] items-center border-b border-[#e8e8e8] px-4 last:border-0 hover:bg-gray-50">
              <span className="truncate text-sm">{member.name}</span>
              <span className="truncate text-sm text-slate-600">{member.position}</span>
              <input type="checkbox" checked={selectedCrew.includes(member.crewUserId)}
                onChange={() => setSelectedCrew((current) => current.includes(member.crewUserId) ? current.filter((id) => id !== member.crewUserId) : [...current, member.crewUserId])}
                className="h-4 w-4 accent-[#162d54]" />
            </label>) : <p className="p-4 text-sm text-slate-500">No certified crew members are in your crew pool. Add them from My Crew first.</p>}
          </div>
        </fieldset>

        {/* Date and time */}
        <div className="mt-4">
          <label
            htmlFor="tripDateTime"
            className="
              mb-2 block text-[14px]
              font-semibold text-[#252525]
              sm:text-[15px]
            "
          >
            Select Date &amp; Time
          </label>

          <input
            id="tripDateTime"
            type="datetime-local"
            min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)}
            value={tripDateTime}
            onChange={(event) => {
              setTripDateTime(event.target.value);
              setStatusMessage("");
            }}
            className="
              min-h-[52px] w-full
              rounded-[12px] border
              border-[#e8e2e2]
              bg-white px-4
              text-[14px] font-normal
              text-[#777777]
              outline-none
              transition-colors
              focus:border-[#162d54]
              focus:ring-1
              focus:ring-[#162d54]
              sm:min-h-[56px] sm:text-[15px]
            "
          />
        </div>

        {statusMessage && (
          <p
            role="status"
            className="
              mt-5 rounded-lg bg-gray-100
              px-4 py-3 text-center
              text-[12px] font-medium
              text-[#162d54]
              sm:text-[13px]
            "
          >
            {statusMessage}
          </p>
        )}

        {/* Schedule button */}
        <button
          type="submit"
          disabled={submitting || !boats.length}
          className="
            mt-auto min-h-[56px] w-full
            rounded-[10px] bg-[#080d68]
            px-5 py-3
            text-[14px] font-medium
            text-white
            transition-colors
            hover:bg-[#121a83]
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#080d68]
            focus-visible:ring-offset-2
            sm:mt-12 sm:max-w-[420px]
            sm:self-center
            sm:text-[15px]
          "
        >
          {submitting ? 'Scheduling...' : 'Schedule Trip'}
        </button>
      </form>

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

export default BoatOwnerNewTripPage;

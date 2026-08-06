import {
  useEffect,
  useState,
} from "react";
import {
  Menu as MenuIcon,
  CalendarPlus,
  Plus,
  Ship,
  Settings,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { operationsApi, type Boat, type Trip } from "../../operations/operationsApi";
import { ownerProfileApi } from "../../profiles/ownerProfileApi";

import groupIcon from "../../assets/icons/group.svg";
import infoIcon from "../../assets/icons/info.svg";
import notificationIcon from "../../assets/icons/notification.svg";
import userIcon from "../../assets/icons/user.svg";
import vesselIcon from "../../assets/icons/vessel.svg";
import dashboardIcon from "../../assets/icons/dashboard.svg";
import crewIcon from "../../assets/icons/crew.svg";
import tripsIcon from "../../assets/icons/trips.svg";

interface MenuItem {
  label: string;
  path: string;
  icon?: string;
  type?: "settings";
}

function EmptyActionPanel({
  title,
  description,
  onAdd,
  kind,
  className = "",
}: {
  title: string;
  description: string;
  onAdd: () => void;
  kind: "boat" | "trip";
  className?: string;
}) {
  const ActionIcon=kind==="trip"?CalendarPlus:Ship;
  const actionLabel=kind==="trip"?"Schedule Trip":"Register Boat";
  return (
    <section className={`relative flex min-h-[270px] w-full flex-col items-start justify-center overflow-hidden rounded-[24px] border border-blue-300/20 bg-gradient-to-br from-[#101d3b] via-[#162d54] to-${kind==="trip"?'[#24558b]':'[#16738a]'} px-7 py-8 text-left shadow-[0_18px_45px_rgba(22,45,84,.22)] sm:px-9 sm:py-10 xl:min-h-[300px] ${className}`}>
      <span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-white/12 text-white ring-1 ring-white/20"><ActionIcon size={25}/></span>
      <h2 className="text-[22px] font-semibold text-white sm:text-[26px]">{title}</h2>
      <p className="mt-2 max-w-sm text-[13px] font-normal leading-6 text-white/75 sm:text-[14px]">{description}</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-7 flex min-h-12 w-full max-w-[260px] items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-[14px] font-semibold text-[#162d54] shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#162d54]"
      >
        {kind==="trip"?<CalendarPlus size={19}/>:<Plus size={19}/>} {actionLabel}
      </button>
    </section>
  );
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

function BoatOwnerDashboard() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(userIcon);

  useEffect(() => {
    if (!session) return;
    let active = true;
    Promise.all([
      operationsApi.boats(session.accessToken),
      operationsApi.trips(session.accessToken),
    ]).then(([nextBoats, nextTrips]) => {
      if (!active) return;
      setBoats(nextBoats);
      setTrips(nextTrips);
      setError("");
    }).catch((requestError: unknown) => {
      if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load owner data.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    let photoUrl: string | undefined;
    Promise.all([
      ownerProfileApi.get(session.accessToken),
      ownerProfileApi.photo(session.accessToken),
    ]).then(([profile, nextPhoto]) => {
      photoUrl = nextPhoto;
      if (!active) {
        if (photoUrl?.startsWith("blob:")) URL.revokeObjectURL(photoUrl);
        return;
      }
      setProfileName(profile.displayName);
      if (photoUrl) setProfilePhoto(photoUrl);
    }).catch(() => {
      // The boats and trips can still render if optional profile media fails.
    });
    return () => {
      active = false;
      if (photoUrl?.startsWith("blob:")) URL.revokeObjectURL(photoUrl);
    };
  }, [session]);

  const ongoingTrips = trips.filter((trip) => trip.status === "Ongoing");
  const ownerName = profileName || boats[0]?.ownerName || session?.email.split("@")[0] || "Boat Owner";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  const openPage = (path: string): void => {
    setIsMenuOpen(false);
    navigate(path);
  };

  return (
   <main className="boat-owner-page min-h-dvh w-full overflow-x-hidden bg-white text-black">
      {/* Hero section */}
      <header
        className="
          relative min-h-[220px] w-full overflow-hidden
          bg-white
          sm:min-h-[290px]
          lg:min-h-[380px]
          xl:min-h-[420px]
        "
      >
        <img
          src="/BG2.png"
          alt=""
          aria-hidden="true"
          className="
            absolute inset-0 h-full w-full object-cover
            object-[62%_center]
            sm:object-[60%_35%]
            lg:object-[70%_32%]
            xl:object-[72%_30%]
          "
        />

        {/* Bottom gradient */}
        <div
          aria-hidden="true"
          className="
            absolute inset-0
            bg-gradient-to-b
            from-white/5
            via-white/5
            to-white
          "
        />

        {/* Notification and menu buttons */}
        <div
          className="
            relative z-20 flex w-full
            items-center justify-between
            px-5 pt-5
            sm:px-8 sm:pt-7
            lg:px-12 lg:pt-8
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
              transition-colors hover:bg-black/10
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-black
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
              transition-colors hover:bg-black/10
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-black
            "
          >
            <MenuIcon
              className="
                h-8 w-8
                sm:h-9 sm:w-9
                lg:h-10 lg:w-10
              "
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Owner information */}
        <div
          className="
            absolute bottom-10 left-4 z-10
            flex items-center gap-3
            sm:bottom-14 sm:left-8 sm:gap-4
            lg:bottom-16 lg:left-12 lg:gap-5
            xl:left-16
          "
        >
          <img
            src={profilePhoto}
            alt={ownerName}
            className="
              h-[68px] w-[68px]
              rounded-full border-2
              border-white object-cover
              shadow-md
              sm:h-[90px] sm:w-[90px]
              lg:h-[115px] lg:w-[115px]
            "
          />

          <div>
            <p
              className="
                text-[8px] font-normal
                leading-normal text-[#4b4b4b]
                sm:text-[10px]
                lg:text-[12px]
              "
            >
              Welcome Back
            </p>

            <h1
              className="
                text-[21px] font-semibold
                leading-tight text-black
                sm:text-[27px]
                lg:text-[36px]
              "
            >
              {ownerName}
            </h1>
          </div>
        </div>

        <h2
          className="
            absolute bottom-0 left-4 z-10
            text-[20px] font-semibold
            leading-[1.6] text-black
            sm:left-8 sm:text-[24px]
            lg:left-12 lg:text-[30px]
            xl:left-16
          "
        >
          My Boats
        </h2>
      </header>

      {/* Dashboard content */}
      <div
        className="
          w-full px-4 pb-8
          sm:px-6 sm:pb-10
          lg:grid
          lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]
          lg:items-start lg:gap-6
          lg:px-10 lg:pb-12
          xl:grid-cols-[minmax(0,2.2fr)_minmax(340px,1fr)]
          xl:px-14
        "
      >
        {/* Boat cards */}
        <section
          aria-label="My boats"
          className="
            grid w-full grid-cols-1 gap-5
            md:grid-cols-2
            lg:gap-6
          "
        >
          {loading && <p className="col-span-full py-10 text-center text-sm text-gray-500">Loading your boats…</p>}
          {!loading && error && <p className="col-span-full py-10 text-center text-sm text-red-600">{error}</p>}
          {!loading && !error && boats.length === 0 && (
            <EmptyActionPanel
              kind="boat"
              title="Register New Boats"
              description="Initialize your boat's digital profile."
              onAdd={() => navigate('/owner/boats/register')}
              className="md:col-span-2"
            />
          )}
          {boats.map((boat) => (
            <article
              key={boat.id}
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
                  grid-cols-[minmax(0,0.8fr)_minmax(145px,1.2fr)]
                  items-center gap-3
                  sm:grid-cols-[minmax(130px,0.8fr)_minmax(210px,1.2fr)]
                  sm:gap-5
                  lg:grid-cols-[minmax(130px,0.8fr)_minmax(200px,1.2fr)]
                  xl:grid-cols-[minmax(150px,0.8fr)_minmax(240px,1.2fr)]
                "
              >
                <div className="min-w-0">
                  <p className="text-[16px] font-semibold sm:text-[18px]">
                    Name
                  </p>

                  <p className="mt-1 truncate text-[16px] font-normal sm:text-[18px]">
                    {boat.name}
                  </p>

                  <p className="mt-3 text-[16px] font-semibold sm:text-[18px]">
                    Reg No
                  </p>

                  <p className="mt-1 text-[16px] font-normal sm:text-[18px]">
                    {boat.registrationNumber}
                  </p>

                  <div className="mt-3 flex items-center gap-1">
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 rounded-full ${boat.approval === "Approved" ? "bg-[#20e620]" : boat.approval === "Rejected" ? "bg-red-500" : "bg-amber-500"}`}
                    />

                    <span className={`text-[8px] font-medium uppercase sm:text-[9px] ${boat.approval === "Approved" ? "text-[#20d820]" : boat.approval === "Rejected" ? "text-red-600" : "text-amber-600"}`}>
                      {boat.approval}
                    </span>
                  </div>
                </div>

                <img
                  src={boat.imageUrl || "/OwnerBoat1.png"}
                  alt={`${boat.name} boat`}
                  className="
                    h-[145px] w-full
                    rounded-[12px] object-cover
                    object-center
                    sm:h-[180px]
                    lg:h-[190px]
                    xl:h-[210px]
                  "
                />
              </div>

              <button
                type="button"
                aria-label={`Open ${boat.name} details`}
                title="Open details"
                onClick={() =>
                  navigate(`/owner/boats/${boat.id}`)
                }
                className="
                  mt-3 flex min-h-9 w-full
                  items-center justify-center gap-1
                  rounded-[9px] bg-[#162d54]
                  px-4 py-2
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
                  className="h-5 w-5 brightness-0 invert"
                />
              </button>
            </article>
          ))}
        </section>

        {/* Ongoing trips */}
        {!loading && !error && ongoingTrips.length === 0 ? (
          <EmptyActionPanel
            kind="trip"
            title="Schedule New Trips"
            description="Initialize your trip's digital profile."
            onAdd={() => navigate('/owner/trips/schedule')}
            className="mt-5 lg:mt-0"
          />
        ) : (
          <section
            className="
            mt-5 w-full rounded-[24px]
            bg-white px-6 py-7
            shadow-[0_6px_12px_rgba(0,0,0,0.15)]
            sm:px-8 sm:py-8
            lg:mt-0
          "
        >
          <div className="mb-7 flex items-center justify-between">
            <h2 className="text-[20px] font-medium sm:text-[24px] lg:text-[28px]">
              Ongoing Trips
            </h2>

            <img
              src={vesselIcon}
              alt=""
              aria-hidden="true"
              className="h-8 w-8 object-contain sm:h-9 sm:w-9"
            />
          </div>

          <div className="flex flex-col gap-7">
            {ongoingTrips.map((trip) => (
              <article
                key={trip.id}
                className="flex items-center justify-between"
              >
                <div>
                  <h3 className="text-[14px] font-semibold sm:text-[16px] lg:text-[18px]">
                    {trip.vesselName}
                  </h3>

                  <p className="text-[8px] font-normal sm:text-[9px] lg:text-[10px]">
                    {trip.registrationNumber}
                  </p>
                </div>

                <button
                  type="button"
                  aria-label={`View ${trip.vesselName} trip`}
                  onClick={() =>
                    navigate(
                      `/owner/trips/${trip.id}`,
                    )
                  }
                  className="
                    flex h-9 w-9 items-center
                    justify-center rounded-full
                    transition-colors hover:bg-gray-100
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-[#162d54]
                  "
                >
                  <img
                    src={infoIcon}
                    alt=""
                    aria-hidden="true"
                    className="h-5 w-5 object-contain"
                  />
                </button>
              </article>
            ))}
          </div>
          </section>
        )}
      </div>

      {/* Menu overlay */}
      {isMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setIsMenuOpen(false)}
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
                onClick={() => setIsMenuOpen(false)}
                className="
                  flex h-10 w-10
                  items-center justify-center
                  rounded-full
                  transition-colors hover:bg-gray-100
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
                  onClick={() => openPage(item.path)}
                  className="
                    flex w-full items-center gap-6
                    rounded-xl px-3 py-4
                    text-left text-black
                    transition-colors hover:bg-gray-100
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-[#162d54]
                  "
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

export default BoatOwnerDashboard;

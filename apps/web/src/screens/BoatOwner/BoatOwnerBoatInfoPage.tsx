import {
  useEffect,
  useState,
} from "react";
import {
  Menu as MenuIcon,
  Settings,
  X,
} from "lucide-react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import groupIcon from "../../assets/icons/group.svg";
import infoIcon from "../../assets/icons/info.svg";
import notificationIcon from "../../assets/icons/notification.svg";
import userIcon from "../../assets/icons/user.svg";
import vesselIcon from "../../assets/icons/vessel.svg";
import dashboardIcon from "../../assets/icons/dashboard.svg";
import crewIcon from "../../assets/icons/crew.svg";
import tripsIcon from "../../assets/icons/trips.svg";
import { useOperations } from "../../operations/useOperations";
import { operationsApi } from "../../operations/operationsApi";
import { useAuth } from "../../auth/useAuth";

interface Certification {
  id: string;
  name: string;
}

interface MenuItem {
  label: string;
  path: string;
  icon?: string;
  type?: "settings";
}

const certifications: Certification[] = [
  {
    id: "sole-proprietorship",
    name: "Certificate of registration of Sole Proprietorship",
  },
  {
    id: "me-certificate",
    name: "ME Certificate",
  },
  {
    id: "vessel-certificate",
    name: "Certificate of Vessel",
  },
  {
    id: "wildlife-certificate",
    name: "Wildlife Certificate",
  },
  {
    id: "coxswain-certificate",
    name: "Coxswain Certificate",
  },
  {
    id: "vessel-registration",
    name: "Vessel Registration Certificate",
  },
  {
    id: "boat-insurance",
    name: "Boat Insurance",
  },
];

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

function BoatOwnerBoatInfoPage() {
  const navigate = useNavigate();
  const { boatId } = useParams<{ boatId: string }>();
  const { boats, loading, error } = useOperations();
  const { session } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const selectedBoat = boats.find((boat) => boat.id === boatId);

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

  const openCertification = async (certificateName: string): Promise<void> => {
    if (!selectedBoat || !session) return;
    const document = selectedBoat.documents.find((item) => item.name === certificateName);
    if (!document) return;
    const url = await operationsApi.downloadBoatDocument(session.accessToken, selectedBoat.id, document.id);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  if (loading) return <main className="grid min-h-dvh place-items-center">Loading vessel information...</main>;
  if (error || !selectedBoat) return <main className="grid min-h-dvh place-items-center">{error || 'Vessel not found.'}</main>;

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

      {/* Boat information */}
      <div
        className="
          mx-auto w-full max-w-[1100px]
          px-4 pb-12
          sm:px-8 sm:pb-14
          lg:px-10
        "
      >
        <section
          className="
            grid grid-cols-[118px_minmax(0,1fr)]
            items-center gap-3
            sm:grid-cols-[190px_minmax(0,1fr)]
            sm:gap-7
            lg:grid-cols-[240px_minmax(0,1fr)]
            lg:gap-10
          "
        >
          {/* Boat text details */}
          <div className="min-w-0">
            <p className="text-[16px] font-semibold sm:text-[19px] lg:text-[21px]">
              Name
            </p>

            <p className="mt-1 truncate text-[16px] font-normal sm:text-[19px] lg:text-[21px]">
              {selectedBoat.name}
            </p>

            <p className="mt-3 text-[16px] font-semibold sm:text-[19px] lg:text-[21px]">
              Reg No
            </p>

            <p className="mt-1 text-[16px] font-normal sm:text-[19px] lg:text-[21px]">
              {selectedBoat.registrationNumber}
            </p>

            <div className="mt-3 flex items-center gap-1">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-[#20e620]"
              />

              <span className="text-[8px] font-medium uppercase text-[#20d820] sm:text-[9px]">
                {selectedBoat.approval}
              </span>
            </div>
          </div>

          {/* Boat image */}
          <img
            src={selectedBoat.imageUrl || "/OwnerBoat1.png"}
            alt={`${selectedBoat.name} boat`}
            className="
              h-[152px] w-full
              rounded-[12px] object-cover
              object-center
              sm:h-[240px]
              lg:h-[300px]
            "
          />
        </section>

        <section className="mt-6 rounded-[12px] border border-[#e8e2e2] p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Vessel Information</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Registration date', selectedBoat.registrationDate],
              ['Hull number', selectedBoat.hullNumber],
              ['Length', `${selectedBoat.lengthMeters} m`],
              ['Beam (width)', `${selectedBoat.widthMeters} m`],
              ['Maximum speed', `${selectedBoat.maximumSpeedKnots} knots`],
              ['Maximum passengers', selectedBoat.maximumCapacity.toString()],
              ['Life jackets', selectedBoat.lifeJacketCount.toString()],
            ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-2"><dt className="font-semibold text-[#162d54]">{label}</dt><dd className="text-right text-slate-600">{value}</dd></div>)}
          </dl>
        </section>

        {/* Certifications */}
        <section className="mt-5 sm:mt-8">
          <div className="mb-2 flex items-center gap-4">
            <h1 className="shrink-0 text-[17px] font-semibold sm:text-[22px] lg:text-[25px]">
              Certifications
            </h1>

            <span
              aria-hidden="true"
              className="mt-1 h-0 flex-1 border-t-2 border-dotted border-[#777777]"
            />
          </div>

          <div
            className="
              ml-2 rounded-[10px]
              border-2 border-dotted
              border-[#777777]
              px-3 pb-6 pt-4
              sm:ml-4 sm:px-5 sm:py-6
            "
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              {certifications.map((certification) => (
                (() => {
                const document = selectedBoat.documents.find((item) => item.name === certification.name);
                return (
                <button
                  key={certification.id}
                  type="button"
                  onClick={() => void openCertification(certification.name)}
                  disabled={!document}
                  className="
                    flex min-h-[62px] w-full
                    items-center rounded-[12px]
                    border border-[#e8e2e2]
                    bg-white px-4 py-3
                    text-left text-[14px]
                    font-medium leading-[1.25]
                    text-black
                    transition-colors
                    hover:border-[#162d54] disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-500
                    hover:bg-gray-50
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-[#162d54]
                    sm:min-h-[70px]
                    sm:px-5 sm:text-[15px]
                    lg:text-[16px]
                  "
                >
                  <span className="min-w-0"><span className="block">{certification.name}</span>{document && <><span className="mt-1 block truncate text-[11px] font-normal text-slate-500">{document.fileName}</span>{document.expirationDate && <span className="mt-1 block text-[11px] font-medium text-amber-700">Expires {new Intl.DateTimeFormat('en-LK',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(`${document.expirationDate}T00:00:00Z`))}</span>}</>}</span>
                </button>
                );
                })()
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Side menu */}
      {isMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setIsMenuOpen(false)}
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
                  className={`
                    flex w-full items-center gap-6
                    rounded-xl px-3 py-4
                    text-left transition-colors
                    hover:bg-gray-100
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-[#162d54]
                    ${
                      item.path === "/owner/boats"
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

export default BoatOwnerBoatInfoPage;

import {
  useEffect,
  useState,
} from "react";
import {
  Menu as MenuIcon,
  Settings,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { connectOperations, operationsApi } from "../../operations/operationsApi";

import groupIcon from "../../assets/icons/group.svg";
import infoIcon from "../../assets/icons/info.svg";
import notificationIcon from "../../assets/icons/notification.svg";
import userIcon from "../../assets/icons/user.svg";
import vesselIcon from "../../assets/icons/vessel.svg";

interface Boat {
  id: string;
  name: string;
  registrationNumber: string;
  image: string;
  approval: string;
  wildlifeApproval: string;
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

function BoatOwnerBoatsPage() {
  const navigate = useNavigate();
  const {session}=useAuth();
  const [boats,setBoats]=useState<Boat[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(()=>{
    if(!session)return;
    let active=true;
    const load=()=>void operationsApi.boats(session.accessToken).then(records=>{if(active)setBoats(records.map(boat=>({id:boat.id,name:boat.name,registrationNumber:boat.registrationNumber,image:boat.imageUrl??"/OwnerBoat1.png",approval:boat.approval,wildlifeApproval:boat.wildlifeApproval})))}).catch(()=>undefined);
    load();const disconnect=connectOperations(session.accessToken,load);
    return()=>{active=false;disconnect()};
  },[session]);

  const approvedBoats=boats.filter(boat=>boat.approval==="Approved");
  const awaitingApprovalBoats=boats.filter(boat=>boat.approval!=="Approved");

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

      {/* Page content */}
      <div
        className="
          w-full px-4 pb-12
          sm:px-7 sm:pb-14
          lg:px-12
          xl:px-16
        "
      >
        <h1
          className="
            mb-5 mt-1 text-[20px]
            font-semibold leading-[1.6]
            sm:mb-7 sm:text-[26px]
            lg:text-[30px]
          "
        >
          My Boats
        </h1>

        <div
          className="
            grid w-full grid-cols-1 gap-6
            md:grid-cols-2
            lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(300px,0.75fr)]
            lg:items-start
          "
        >
          <h2 className="md:col-span-2 lg:col-span-3 text-[17px] font-semibold sm:text-[20px]">Approved Boats</h2>
          {approvedBoats.map((boat) => (
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
                  lg:grid-cols-[minmax(130px,0.8fr)_minmax(190px,1.2fr)]
                  xl:grid-cols-[minmax(150px,0.8fr)_minmax(230px,1.2fr)]
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
                      className="h-2 w-2 rounded-full bg-[#20e620]"
                    />

                    <span className="text-[8px] font-medium uppercase text-[#20d820] sm:text-[9px]">
                      Approved
                    </span>
                  </div>
                </div>

                <img
                  src={boat.image}
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
                  className="h-4 w-4 brightness-0 invert"
                />
              </button>
            </article>
          ))}
          {approvedBoats.length===0&&<p className="md:col-span-2 lg:col-span-3 text-sm text-slate-500">No boats have completed approval yet.</p>}

          <h2 className="md:col-span-2 lg:col-span-3 mt-3 text-[17px] font-semibold sm:text-[20px]">Yet to be Approved</h2>
          {awaitingApprovalBoats.map((boat) => (
            <BoatCard key={boat.id} boat={boat} onOpen={()=>navigate(`/owner/boats/${boat.id}`)}/>
          ))}
          {awaitingApprovalBoats.length===0&&<p className="md:col-span-2 lg:col-span-3 text-sm text-slate-500">No boats are awaiting approval.</p>}

          {/* Register boat panel */}
          <section
            className="
              flex w-full flex-col
              items-center justify-center
              rounded-[16px] bg-[#162d54]
              px-5 py-7 text-center
              md:col-span-2
              sm:px-8 sm:py-9
              lg:col-span-1 lg:min-h-[270px]
              xl:min-h-[300px]
            "
          >
            <h2 className="text-[19px] font-semibold text-white sm:text-[22px]">
              Register New Boats
            </h2>

            <p className="mt-1 text-[11px] font-normal text-white/90 sm:text-[13px]">
              Initialize your boat&apos;s digital profile.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate("/owner/boats/register")
              }
              className="
                mt-7 min-h-8 w-full
                max-w-[230px] rounded-[5px]
                bg-white px-5 py-2
                text-[11px] font-semibold
                text-[#162d54]
                transition-colors
                hover:bg-gray-100
                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-white
                focus-visible:ring-offset-2
                focus-visible:ring-offset-[#162d54]
                sm:max-w-[280px] sm:text-[12px]
              "
            >
              Add More
            </button>
          </section>
        </div>
      </div>

      {/* Menu */}
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

function BoatCard({boat,onOpen}:{boat:Boat;onOpen:()=>void}){
 const declined=boat.approval==="Rejected";
 return <article className="w-full overflow-hidden rounded-[22px] bg-white p-3 shadow-[0_6px_9px_rgba(0,0,0,0.22)] sm:p-4">
  <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(145px,1.2fr)] items-center gap-3 sm:grid-cols-[minmax(130px,0.8fr)_minmax(210px,1.2fr)] sm:gap-5 lg:grid-cols-[minmax(130px,0.8fr)_minmax(190px,1.2fr)] xl:grid-cols-[minmax(150px,0.8fr)_minmax(230px,1.2fr)]">
   <div className="min-w-0"><p className="text-[16px] font-semibold sm:text-[18px]">Name</p><p className="mt-1 truncate text-[16px] sm:text-[18px]">{boat.name}</p><p className="mt-3 text-[16px] font-semibold sm:text-[18px]">Reg No</p><p className="mt-1 text-[16px] sm:text-[18px]">{boat.registrationNumber}</p><div className="mt-3 flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${declined?"bg-red-500":"bg-amber-400"}`} aria-hidden="true"/><span className={`text-[8px] font-medium uppercase sm:text-[9px] ${declined?"text-red-500":"text-amber-600"}`}>{declined?"Approval declined":"Approval pending"}</span></div></div>
   <img src={boat.image} alt={`${boat.name} boat`} className="h-[145px] w-full rounded-[12px] object-cover object-center sm:h-[180px] lg:h-[190px] xl:h-[210px]"/>
  </div>
  <button type="button" onClick={onOpen} className="mt-3 flex min-h-9 w-full items-center justify-center gap-1 rounded-[9px] bg-[#162d54] px-4 py-2 text-[12px] text-white transition-colors hover:bg-[#203d6c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#162d54] focus-visible:ring-offset-2 sm:min-h-10 sm:text-[13px]"><span>Info</span><img src={infoIcon} alt="" aria-hidden="true" className="h-4 w-4 brightness-0 invert"/></button>
 </article>;
}

export default BoatOwnerBoatsPage;

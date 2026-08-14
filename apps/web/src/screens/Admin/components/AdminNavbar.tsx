import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth";
import { Icon } from "../../../components/ui/icon";
import { Anchor, CircleUserRound, FileWarning, House, LogOut, Ship, UsersRound, UserRoundCog } from "lucide-react";

interface NavigationItem {
  label: string;
  path: string;
  icon: typeof House;
}

const adminNavigationItems: NavigationItem[] = [
  {
    label: "Users",
    path: "/admin/manage-users",
    icon: UsersRound,
  },
  {
    label: "Boats",
    path: "/admin/boats",
    icon: Ship,
  },
  {
    label: "Trips",
    path: "/admin/trips",
    icon: Anchor,
  },
  {
    label: "Staff",
    path: "/admin/manage-staff",
    icon: UserRoundCog,
  },
  {
    label: "Owners",
    path: "/admin/manage-boat-owners",
    icon: CircleUserRound,
  },
  {
    label: "Complaints",
    path: "/admin/complaints",
    icon: FileWarning,
  },
];

const AdminNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, session } = useAuth();
  const isWildlife = session?.roles.includes("Wildlife") ?? false;
  const homePath = isWildlife ? "/wildlife" : "/admin";
  const notificationsPath = isWildlife ? "/wildlife/complaints" : "/admin/complaints";
  const navigationItems = adminNavigationItems
    .filter((item) => !isWildlife || item.label !== "Staff")
    .map((item) => isWildlife ? { ...item, path: item.path.replace("/admin", "/wildlife") } : item);

  const handleLogout = (): void => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to={homePath} className="flex shrink-0 items-center" aria-label="Go to portal dashboard">
          <img
            src={isWildlife ? "/WildlifeAuthority.png" : "/SLCG.png"}
            alt={isWildlife ? "Department of Wildlife Conservation" : "Sri Lanka Coast Guard Logo"}
            className="h-9 w-auto object-contain sm:h-10"
          />
        </Link>

        <nav className="hidden items-center gap-6 text-sm lg:flex" aria-label="Admin navigation">
          <button
            type="button"
            onClick={() => navigate(notificationsPath)}
            aria-label="Notifications"
            className="flex items-center justify-center text-slate-500 transition-colors hover:text-[#14223d]"
          >
            <Icon name="notification" size={20} />
          </button>

          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.path}
                to={isActive ? homePath : item.path}
                aria-label={isActive ? "Dashboard" : item.label}
                title={isActive ? "Dashboard" : item.label}
                className={`rounded-full p-2 transition-colors hover:bg-slate-100 hover:text-[#14223d] ${
                  isActive ? "font-bold text-[#14223d]" : "text-slate-500"
                }`}
              >
                <span className="flex items-center gap-2">{isActive ? <House size={18}/> : <item.icon size={18}/>}<span>{isActive ? "Dashboard" : item.label}</span></span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out" title="Log out" className="rounded-full bg-[#14223d] p-2.5 text-white shadow-sm transition hover:bg-[#22375f] hover:shadow"
          >
            <span className="flex items-center gap-2"><LogOut size={18}/><span>Log out</span></span>
          </button>
        </nav>

        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="inline-flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-md text-[#14223d] transition hover:bg-slate-100 lg:hidden"
          aria-label="Toggle admin navigation"
          aria-expanded={isMenuOpen}
        >
          <span className={`h-0.5 w-5 bg-current transition-transform ${isMenuOpen ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`h-0.5 w-5 bg-current transition-opacity ${isMenuOpen ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-5 bg-current transition-transform ${isMenuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </div>

      {isMenuOpen && (
        <nav className="border-t border-slate-200 bg-white px-4 py-4 shadow-lg lg:hidden" aria-label="Mobile admin navigation">
          <div className="mx-auto grid max-w-7xl gap-1">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  to={isActive ? homePath : item.path}
                  onClick={() => setIsMenuOpen(false)}
                  aria-label={isActive ? "Dashboard" : item.label} title={isActive ? "Dashboard" : item.label} className={`flex justify-center rounded-md px-3 py-3 transition-colors ${
                    isActive ? "bg-slate-100 text-[#14223d]" : "text-slate-600 hover:bg-slate-50 hover:text-[#14223d]"
                  }`}
                >
                  <span className="flex items-center gap-2">{isActive ? <House size={20}/> : <item.icon size={20}/>}<span>{isActive ? "Dashboard" : item.label}</span></span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out" title="Log out" className="mt-2 flex justify-center rounded-md bg-[#14223d] px-4 py-3 text-white"
            >
              <span className="flex items-center gap-2"><LogOut size={20}/><span>Log out</span></span>
            </button>
          </div>
        </nav>
      )}
    </header>
  );
};

export default AdminNavbar;
